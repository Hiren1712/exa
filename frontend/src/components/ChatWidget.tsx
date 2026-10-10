import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatTurn } from '../api/ai';
import { aiApi } from '../api/ai';
import { extractError } from '../api/client';
import { Icon } from './Icon';
import { MathText } from './MathText';

interface StoredMessage extends ChatTurn {
  id: string;
  createdAt: number;
}

interface ChatThread {
  id: string;
  title: string;
  updatedAt: number;
  messages: StoredMessage[];
}

interface ChatWidgetProps {
  userId: number;
}

const MAX_STORED_THREADS = 20;
const MAX_STORED_MESSAGES = 80;
const MAX_INPUT_LENGTH = 4000;

function storageKey(userId: number) {
  return `exa-chat-history-${userId}`;
}

function readThreads(userId: number): ChatThread[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((thread): thread is ChatThread =>
      typeof thread?.id === 'string'
      && typeof thread?.title === 'string'
      && Array.isArray(thread?.messages)
      && thread.messages.every((message: StoredMessage) =>
        typeof message?.id === 'string'
        && (message.role === 'user' || message.role === 'assistant')
        && typeof message.content === 'string'
        && typeof message.createdAt === 'number'),
    ).slice(0, MAX_STORED_THREADS);
  } catch (error) {
    console.error('Không thể đọc lịch sử chatbot đã lưu:', error);
    return [];
  }
}

function createId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeTitle(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

export function ChatWidget({ userId }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>(() => readThreads(userId));
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [pendingHistory, setPendingHistory] = useState<ChatTurn[] | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;
  const messages = useMemo(() => activeThread?.messages ?? [], [activeThread]);
  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.updatedAt - a.updatedAt),
    [threads],
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(
        threads.slice(0, MAX_STORED_THREADS).map((thread) => ({
          ...thread,
          messages: thread.messages.slice(-MAX_STORED_MESSAGES),
        })),
      ));
    } catch (storageError) {
      console.error('Không thể lưu lịch sử chatbot trên thiết bị:', storageError);
    }
  }, [threads, userId]);

  useEffect(() => {
    if (!open || showHistory) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open, sending, showHistory]);

  useEffect(() => {
    if (open && !showHistory) inputRef.current?.focus();
  }, [open, showHistory]);

  const ask = async (history: ChatTurn[], threadId: string) => {
    setSending(true);
    setError('');
    try {
      const reply = await aiApi.chat(history);
      const assistantMessage: StoredMessage = {
        id: createId(),
        role: 'assistant',
        content: reply,
        createdAt: Date.now(),
      };
      setThreads((current) => current.map((thread) => thread.id === threadId
        ? { ...thread, messages: [...thread.messages, assistantMessage], updatedAt: Date.now() }
        : thread));
      setPendingHistory(null);
    } catch (requestError) {
      setError(extractError(requestError));
      setPendingHistory(history);
    } finally {
      setSending(false);
    }
  };

  const submitMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    const threadId = activeThread?.id ?? createId();
    const userMessage: StoredMessage = {
      id: createId(),
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    const currentMessages = activeThread?.messages ?? [];
    const nextThread: ChatThread = {
      id: threadId,
      title: activeThread?.title ?? makeTitle(content),
      updatedAt: Date.now(),
      messages: [...currentMessages, userMessage],
    };
    setThreads((current) => [
      nextThread,
      ...current.filter((thread) => thread.id !== threadId),
    ].slice(0, MAX_STORED_THREADS));
    setActiveThreadId(threadId);
    setInput('');

    const history: ChatTurn[] = nextThread.messages
      .slice(-11)
      .map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    if (history[0]?.role === 'assistant') history.shift();
    await ask(history, threadId);
  };

  const retry = async () => {
    if (!pendingHistory || !activeThreadId || sending) return;
    await ask(pendingHistory, activeThreadId);
  };

  const copyMessage = async (message: StoredMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1500);
    } catch {
      setError('Không thể sao chép câu trả lời. Hãy chọn và sao chép nội dung thủ công.');
    }
  };

  const startNewChat = () => {
    setActiveThreadId(null);
    setShowHistory(false);
    setError('');
    setPendingHistory(null);
    setInput('');
  };

  const removeThread = (threadId: string) => {
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
      setPendingHistory(null);
      setError('');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Mở trợ lý EXA"
          className="fixed bottom-5 right-5 z-50 flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 px-5 font-semibold text-white shadow-xl shadow-blue-600/30 transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          <Icon name="message" size={21} />
          <span className="hidden sm:inline">Hỏi EXA AI</span>
        </button>
      )}

      {open && (
        <section
          aria-label="Chat với trợ lý EXA"
          className="fixed bottom-3 right-3 z-50 flex h-[min(590px,calc(100dvh-1.5rem))] w-[calc(100vw-1.5rem)] max-w-[370px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-900 sm:bottom-5 sm:right-5 sm:h-[min(590px,calc(100dvh-2.5rem))]"
        >
          <header className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
              <Icon name="sparkle" size={21} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold">ExaBot</h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-blue-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Hỏi bài, giải thích và hỗ trợ học tập
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowHistory((value) => !value); setError(''); }}
              aria-label={showHistory ? 'Đóng lịch sử trò chuyện' : 'Lịch sử trò chuyện'}
              title="Lịch sử trò chuyện"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/90 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <Icon name="history" size={19} />
            </button>
            <button
              type="button"
              onClick={startNewChat}
              aria-label="Cuộc trò chuyện mới"
              title="Cuộc trò chuyện mới"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/90 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <Icon name="plus" size={20} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng chatbot"
              title="Đóng"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/90 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <Icon name="x" size={19} />
            </button>
          </header>

          {showHistory ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lịch sử trò chuyện</h3>
                <button type="button" onClick={startNewChat} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                  + Trò chuyện mới
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {sortedThreads.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-slate-500">Chưa có cuộc trò chuyện nào.</p>
                ) : sortedThreads.map((thread) => (
                  <div key={thread.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => { setActiveThreadId(thread.id); setShowHistory(false); setError(''); setPendingHistory(null); }}
                      className={`min-w-0 flex-1 rounded-xl px-3 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                        activeThreadId === thread.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                      }`}
                    >
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{thread.title}</span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        {thread.messages.length} tin nhắn · {formatTime(thread.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeThread(thread.id)}
                      aria-label={`Xóa cuộc trò chuyện ${thread.title}`}
                      title="Xóa cuộc trò chuyện"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-100 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400 dark:border-slate-800">
                Lịch sử chỉ được lưu trên trình duyệt và tài khoản đang dùng.
              </p>
            </div>
          ) : (
            <>
              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 px-3 py-4 dark:bg-slate-950/60 sm:px-4">
                {messages.length === 0 ? (
                  <div className="flex min-h-full flex-col justify-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                      <Icon name="sparkle" size={24} />
                    </div>
                    <h3 className="text-center text-base font-bold text-slate-900 dark:text-white">Mình có thể giúp gì cho bạn?</h3>
                    <p className="mx-auto mt-1 max-w-xs text-center text-xs leading-relaxed text-slate-500">
                      Hỏi bài, nhờ giải thích khái niệm hoặc cùng luyện tập từng bước.
                    </p>
                    <div className="mt-5 space-y-2">
                      {[
                        'Giải thích đạo hàm bằng ví dụ dễ hiểu',
                        'Hướng dẫn giải phương trình bậc hai',
                        'Tóm tắt quang hợp ở thực vật',
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setInput(suggestion)}
                          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                          message.role === 'user'
                            ? 'rounded-br-md bg-blue-600 text-white'
                            : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                        }`}>
                          <MathText className="block whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {message.content}
                          </MathText>
                          <div className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                            message.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                          }`}>
                            {message.role === 'assistant' && (
                              <button
                                type="button"
                                onClick={() => void copyMessage(message)}
                                aria-label={copiedMessageId === message.id ? 'Đã sao chép câu trả lời' : 'Sao chép câu trả lời'}
                                title={copiedMessageId === message.id ? 'Đã sao chép' : 'Sao chép'}
                                className="rounded px-1 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                              >
                                {copiedMessageId === message.id ? 'Đã chép' : 'Sao chép'}
                              </button>
                            )}
                            <time dateTime={new Date(message.createdAt).toISOString()}>{formatTime(message.createdAt)}</time>
                          </div>
                        </div>
                      </div>
                    ))}
                    {sending && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                          <span className="flex gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.2s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.1s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500" />
                          </span>
                          EXA đang trả lời...
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div role="alert" className="flex shrink-0 items-center gap-2 border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-950 dark:bg-red-950/40 dark:text-red-200">
                  <span className="min-w-0 flex-1">{error}</span>
                  {pendingHistory && <button type="button" onClick={() => void retry()} disabled={sending} className="shrink-0 font-bold underline disabled:opacity-50">Thử lại</button>}
                </div>
              )}

              <form onSubmit={(event) => void submitMessage(event)} className="shrink-0 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:ring-blue-950">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value.slice(0, MAX_INPUT_LENGTH))}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhắn tin cho EXA AI..."
                    aria-label="Tin nhắn của bạn"
                    rows={1}
                    maxLength={MAX_INPUT_LENGTH}
                    disabled={sending}
                    className="max-h-32 min-h-9 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    aria-label="Gửi tin nhắn"
                    title="Gửi"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                  >
                    <Icon name="send" size={16} />
                  </button>
                </div>
                <div className="mt-1.5 flex justify-between px-1 text-[10px] text-slate-400">
                  <span>Enter để gửi · Shift+Enter xuống dòng</span>
                  <span>{input.length}/{MAX_INPUT_LENGTH}</span>
                </div>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
}
