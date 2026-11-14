import {
  FormEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import type { ChatProvider, ChatTurn } from '../api/ai';
import { aiApi } from '../api/ai';
import { extractError } from '../api/client';
import { ExaBot } from './ExaBot';
import { Icon } from './Icon';
import { decodeHtmlEntities, MathText } from './MathText';
import { useLanguage } from '../i18n';

interface StoredMessage extends ChatTurn {
  id: string;
  createdAt: number;
  moderationFlagged?: boolean;
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
const LAUNCHER_SIZE = 48;
const LAUNCHER_EDGE = 8;
const CHAT_INLINE_PART = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g;

interface FloatingPosition {
  x: number;
  y: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

function isFloatingPosition(value: unknown): value is FloatingPosition {
  return typeof value === 'object' && value !== null
    && 'x' in value && typeof value.x === 'number' && Number.isFinite(value.x)
    && 'y' in value && typeof value.y === 'number' && Number.isFinite(value.y);
}

function getViewportSize(): ViewportSize {
  return {
    width: typeof window === 'undefined' ? 1024 : window.innerWidth,
    height: typeof window === 'undefined' ? 768 : window.innerHeight,
  };
}

function clampLauncherPosition(position: FloatingPosition, viewport: ViewportSize): FloatingPosition {
  return {
    x: Math.min(Math.max(LAUNCHER_EDGE, position.x), Math.max(LAUNCHER_EDGE, viewport.width - LAUNCHER_SIZE - LAUNCHER_EDGE)),
    y: Math.min(Math.max(LAUNCHER_EDGE, position.y), Math.max(LAUNCHER_EDGE, viewport.height - LAUNCHER_SIZE - LAUNCHER_EDGE)),
  };
}

function launcherStorageKey(userId: number) {
  return `exa-chat-launcher-position-${userId}`;
}

function saveLauncherPosition(userId: number, position: FloatingPosition) {
  try {
    localStorage.setItem(launcherStorageKey(userId), JSON.stringify(position));
  } catch (error) {
    console.error('Không thể lưu vị trí nút ExaBot trên thiết bị:', error);
  }
}

function readLauncherPosition(userId: number): FloatingPosition {
  const viewport = getViewportSize();
  const defaultPosition = {
    x: viewport.width - LAUNCHER_SIZE - 24,
    y: viewport.height - LAUNCHER_SIZE - 24,
  };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(launcherStorageKey(userId)) || 'null');
    if (isFloatingPosition(saved)) return clampLauncherPosition(saved, viewport);
  } catch (error) {
    console.error('Không thể đọc vị trí nút ExaBot đã lưu:', error);
  }
  return clampLauncherPosition(defaultPosition, viewport);
}

function renderInlineChatText(text: string): ReactNode[] {
  return text.split(CHAT_INLINE_PART).map((part, index) => {
    if (!part) return null;
    const key = `${index}-${part}`;
    if (/^(?:\$\$[\s\S]+\$\$|\\\[[\s\S]+\\\]|\$[^$\n]+\$|\\\([\s\S]+\\\))$/.test(part)) {
      return <MathText key={key}>{part}</MathText>;
    }
    if (part.startsWith('**') || part.startsWith('__')) {
      return <strong key={key}><MathText>{part.slice(2, -2)}</MathText></strong>;
    }
    if (part.startsWith('~~')) {
      return <del key={key}><MathText>{part.slice(2, -2)}</MathText></del>;
    }
    if (part.startsWith('`')) {
      return <code key={key} className="rounded bg-slate-100 px-1 dark:bg-slate-800">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') || part.startsWith('_')) {
      return <em key={key}><MathText>{part.slice(1, -1)}</MathText></em>;
    }
    return <MathText key={key}>{part}</MathText>;
  });
}

function ChatMessageContent({ content }: { content: string }) {
  const lines = decodeHtmlEntities(content).split('\n');

  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const key = `${index}-${line}`;
        const heading = /^(#{1,6})\s+(.+)$/.exec(line);
        const bullet = /^\s*[-*+]\s+(.+)$/.exec(line);
        const numbered = /^\s*(\d+)[.)]\s+(.+)$/.exec(line);
        const quote = /^\s*>\s?(.*)$/.exec(line);

        if (!line.trim()) return <div key={key} aria-hidden="true" className="h-1" />;
        if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
          return <hr key={key} className="my-2 border-slate-200 dark:border-slate-700" />;
        }
        if (heading) {
          const size = heading[1].length <= 2 ? 'text-sm font-bold' : 'font-semibold';
          return <p key={key} className={size}>{renderInlineChatText(heading[2])}</p>;
        }
        if (bullet) {
          return <div key={key} className="flex gap-2 pl-2"><span aria-hidden="true">•</span><span>{renderInlineChatText(bullet[1])}</span></div>;
        }
        if (numbered) {
          return <div key={key} className="flex gap-2 pl-2"><span>{numbered[1]}.</span><span>{renderInlineChatText(numbered[2])}</span></div>;
        }
        if (quote) {
          return <blockquote key={key} className="border-l-2 border-blue-300 pl-2 text-slate-600 dark:border-blue-700 dark:text-slate-300">{renderInlineChatText(quote[1])}</blockquote>;
        }
        return <p key={key}>{renderInlineChatText(line)}</p>;
      })}
    </div>
  );
}

function storageKey(userId: number) {
  return `exa-chat-history-${userId}`;
}

function providerStorageKey(userId: number) {
  return `exa-chat-provider-${userId}`;
}

function readChatProvider(userId: number): ChatProvider {
  try {
    const value = localStorage.getItem(providerStorageKey(userId));
    return value === 'GROQ' ? 'GROQ' : 'GEMINI';
  } catch (error) {
    console.error('Không thể đọc lựa chọn AI chatbot đã lưu:', error);
    return 'GEMINI';
  }
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

function formatTime(timestamp: number, language: 'vi' | 'en') {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function formatCountdown(seconds: number) {
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function flagLatestUserMessage(messages: StoredMessage[]) {
  const updatedMessages = [...messages];
  for (let index = updatedMessages.length - 1; index >= 0; index -= 1) {
    if (updatedMessages[index].role === 'user') {
      updatedMessages[index] = { ...updatedMessages[index], moderationFlagged: true };
      break;
    }
  }
  return updatedMessages;
}

export function ChatWidget({ userId }: ChatWidgetProps) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>(() => readThreads(userId));
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<ChatProvider>(() => readChatProvider(userId));
  const [sending, setSending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [moderationWarning, setModerationWarning] = useState(false);
  const [chatBanned, setChatBanned] = useState(false);
  const [error, setError] = useState('');
  const [pendingHistory, setPendingHistory] = useState<ChatTurn[] | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [viewport, setViewport] = useState(getViewportSize);
  const [launcherPosition, setLauncherPosition] = useState(() => readLauncherPosition(userId));
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherDrag = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    moved: boolean;
    latestPosition: FloatingPosition;
    frameId: number | null;
  } | null>(null);
  const suppressLauncherClick = useRef(false);

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
    try {
      localStorage.setItem(providerStorageKey(userId), provider);
    } catch (error) {
      console.error('Không thể lưu lựa chọn AI chatbot trên thiết bị:', error);
    }
  }, [provider, userId]);

  useEffect(() => {
    const handleResize = () => {
      const nextViewport = getViewportSize();
      setViewport(nextViewport);
      setLauncherPosition((current) => clampLauncherPosition(current, nextViewport));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!open || showHistory) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open, sending, showHistory]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = window.setTimeout(
      () => setCooldownSeconds((remaining) => Math.max(0, remaining - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (cooldownSeconds === 0) setChatBanned(false);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (open && !showHistory) inputRef.current?.focus();
  }, [open, showHistory]);

  const ask = async (history: ChatTurn[], threadId: string, selectedProvider: ChatProvider) => {
    setSending(true);
    setError('');
    setModerationWarning(false);
    setCooldownSeconds(7);
    try {
      const response = await aiApi.chat(history, selectedProvider);
      setCooldownSeconds(response.cooldownSeconds);
      if (response.moderationWarning) {
        setModerationWarning(true);
        setError(response.reply);
        setPendingHistory(null);
        setThreads((current) => current.map((thread) => {
          if (thread.id !== threadId) return thread;
          return { ...thread, messages: flagLatestUserMessage(thread.messages) };
        }));
        return;
      }

      const assistantMessage: StoredMessage = {
        id: createId(),
        role: 'assistant',
        content: response.reply,
        createdAt: Date.now(),
      };
      setThreads((current) => current.map((thread) => thread.id === threadId
        ? { ...thread, messages: [...thread.messages, assistantMessage], updatedAt: Date.now() }
        : thread));
      setPendingHistory(null);
    } catch (requestError) {
      setError(extractError(requestError));
      const errorResponse = axios.isAxiosError(requestError)
        ? requestError.response?.data as { code?: unknown } | undefined
        : undefined;
      const responseCode = typeof errorResponse?.code === 'string' ? errorResponse.code : '';
      const retryAfter = axios.isAxiosError(requestError)
        ? Number(requestError.response?.headers?.['retry-after'])
        : 0;
      if (retryAfter > 0) {
        setCooldownSeconds(retryAfter);
        setChatBanned(responseCode === 'CHAT_VIOLATION_BANNED' || responseCode === 'CHAT_TEMPORARILY_BANNED');
        setModerationWarning(responseCode.startsWith('CHAT_'));
        setPendingHistory(null);
        setThreads((current) => current.map((thread) => {
          if (thread.id !== threadId) return thread;
          return { ...thread, messages: flagLatestUserMessage(thread.messages) };
        }));
      } else {
        setPendingHistory(history);
      }
    } finally {
      setSending(false);
    }
  };

  const submitMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = input.trim();
    if (!content || sending || cooldownSeconds > 0) return;

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
      .filter((message) => !message.moderationFlagged)
      .slice(-11)
      .map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    if (history[0]?.role === 'assistant') history.shift();
    await ask(history, threadId, provider);
  };

  const retry = async () => {
    if (!pendingHistory || !activeThreadId || sending || cooldownSeconds > 0) return;
    await ask(pendingHistory, activeThreadId, provider);
  };

  const copyMessage = async (message: StoredMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1500);
    } catch {
      setError(t('Không thể sao chép câu trả lời. Hãy chọn và sao chép nội dung thủ công.'));
    }
  };

  const startNewChat = () => {
    setActiveThreadId(null);
    setShowHistory(false);
    setError('');
    setModerationWarning(false);
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

  const handleLauncherPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    suppressLauncherClick.current = false;
    launcherDrag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - launcherPosition.x,
      offsetY: event.clientY - launcherPosition.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      latestPosition: launcherPosition,
      frameId: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleLauncherPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = launcherDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
      drag.moved = true;
    }
    drag.latestPosition = clampLauncherPosition({
      x: event.clientX - drag.offsetX,
      y: event.clientY - drag.offsetY,
    }, viewport);
    if (drag.moved) {
      event.preventDefault();
      if (drag.frameId === null) {
        drag.frameId = window.requestAnimationFrame(() => {
          drag.frameId = null;
          if (launcherDrag.current === drag) setLauncherPosition(drag.latestPosition);
        });
      }
    }
  };

  const handleLauncherPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = launcherDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.frameId !== null) window.cancelAnimationFrame(drag.frameId);
    suppressLauncherClick.current = drag.moved;
    if (drag.moved) {
      setLauncherPosition(drag.latestPosition);
      saveLauncherPosition(userId, drag.latestPosition);
    }
    launcherDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const chatPanelStyle = useMemo(() => {
    if (viewport.width < 640) return undefined;
    const panelWidth = Math.min(440, viewport.width - 40);
    const panelHeight = Math.min(700, viewport.height - 40);
    const left = Math.min(
      Math.max(20, launcherPosition.x + LAUNCHER_SIZE / 2 - panelWidth / 2),
      viewport.width - panelWidth - 20,
    );
    const desiredTop = launcherPosition.y > viewport.height / 2
      ? launcherPosition.y - panelHeight - 12
      : launcherPosition.y + LAUNCHER_SIZE + 12;
    const top = Math.min(Math.max(20, desiredTop), viewport.height - panelHeight - 20);
    return { left, top, right: 'auto', bottom: 'auto' };
  }, [launcherPosition, viewport]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onPointerDown={handleLauncherPointerDown}
          onPointerMove={handleLauncherPointerMove}
          onPointerUp={handleLauncherPointerUp}
          onPointerCancel={handleLauncherPointerUp}
          onLostPointerCapture={handleLauncherPointerUp}
          onClick={() => {
            if (suppressLauncherClick.current) {
              suppressLauncherClick.current = false;
              return;
            }
            setOpen(true);
          }}
          aria-label={t('Mở trợ lý EXA')}
          title={t('Kéo để di chuyển · Nhấn để mở trợ lý')}
          style={{ left: launcherPosition.x, top: launcherPosition.y }}
          className="fixed z-50 flex h-12 w-12 touch-none cursor-grab items-center justify-center rounded-full bg-slate-950 p-0 text-white shadow-xl shadow-blue-950/25 transition hover:scale-105 hover:bg-blue-950 hover:shadow-2xl active:cursor-grabbing focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          <span className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
            <ExaBot size={30} />
          </span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-labelledby="exa-chat-title"
          style={chatPanelStyle}
          className="fixed inset-x-0 bottom-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-900 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(700px,calc(100dvh-2.5rem))] sm:w-[min(440px,calc(100vw-2.5rem))] sm:rounded-[1.75rem]"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-950 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white sm:pt-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-950/30">
              <ExaBot size={36} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="exa-chat-title" className="truncate text-sm font-bold">{t('Gia sư EXA')}</h2>
              <p className="mt-0.5 truncate text-xs text-slate-300">
                {t('Giải thích · Luyện tập · Khám phá')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowHistory((value) => !value); setError(''); }}
              aria-label={t(showHistory ? 'Đóng lịch sử trò chuyện' : 'Lịch sử trò chuyện')}
              title={t('Lịch sử trò chuyện')}
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70 ${showHistory ? 'bg-white/10' : ''}`}
            >
              <Icon name="history" size={19} />
            </button>
            <button
              type="button"
              onClick={startNewChat}
              aria-label={t('Cuộc trò chuyện mới')}
              title={t('Cuộc trò chuyện mới')}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <Icon name="plus" size={20} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('Đóng chatbot')}
              title={t('Đóng')}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <Icon name="x" size={19} />
            </button>
          </header>

          {showHistory ? (
            <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('Lịch sử trò chuyện')}</h3>
                <button type="button" onClick={startNewChat} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/50">
                  + Trò chuyện mới
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
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
                        {t('{{count}} tin nhắn · {{time}}', {
                          count: thread.messages.length,
                          time: formatTime(thread.updatedAt, language),
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeThread(thread.id)}
                      aria-label={t('Xóa cuộc trò chuyện {{title}}', { title: thread.title })}
                      title={t('Xóa cuộc trò chuyện')}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-100 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400 dark:border-slate-800">
                {t('Lịch sử chỉ được lưu trên trình duyệt và tài khoản đang dùng.')}
              </p>
            </div>
          ) : (
            <>
              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-5 dark:bg-slate-950/70 sm:px-4">
                {messages.length === 0 ? (
                  <div className="flex min-h-full flex-col justify-center">
                    <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
                      <ExaBot size={48} />
                    </div>
                    <h3 className="text-center text-lg font-bold tracking-tight text-slate-900 dark:text-white">{t('Bắt đầu từ điều bạn tò mò')}</h3>
                    <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {t('Hỏi bài, khám phá khái niệm hoặc luyện tập từng bước cùng gia sư EXA.')}
                    </p>
                    <div className="mt-6 space-y-2.5">
                      {[
                        'Giải thích đạo hàm bằng ví dụ dễ hiểu',
                        'Hướng dẫn giải phương trình bậc hai',
                        'Tóm tắt quang hợp ở thực vật',
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setInput(suggestion)}
                          className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {t(suggestion)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.role === 'assistant' && (
                          <div aria-hidden="true" className="mb-5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            <ExaBot size={24} />
                          </div>
                        )}
                        <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                          message.role === 'user'
                            ? 'rounded-br-md bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                            : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                        }`}>
                          {message.role === 'assistant' ? (
                            <div className="break-words text-sm leading-relaxed">
                              <ChatMessageContent content={message.content} />
                            </div>
                          ) : (
                            <MathText className="block whitespace-pre-wrap break-words text-sm leading-relaxed">
                              {message.content}
                            </MathText>
                          )}
                          <div className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                            message.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                          }`}>
                            {message.role === 'assistant' && (
                              <button
                                type="button"
                                onClick={() => void copyMessage(message)}
                                aria-label={t(copiedMessageId === message.id ? 'Đã sao chép câu trả lời' : 'Sao chép câu trả lời')}
                                title={t(copiedMessageId === message.id ? 'Đã sao chép' : 'Sao chép')}
                                className="rounded px-1 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                              >
                                {t(copiedMessageId === message.id ? 'Đã chép' : 'Sao chép')}
                              </button>
                            )}
                            <time dateTime={new Date(message.createdAt).toISOString()}>{formatTime(message.createdAt, language)}</time>
                          </div>
                        </div>
                      </div>
                    ))}
                    {sending && (
                      <div className="flex items-end gap-2">
                        <div aria-hidden="true" className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          <ExaBot size={24} />
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          <span className="flex gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.2s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.1s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500" />
                          </span>
                          {t('Gia sư EXA đang suy nghĩ...')}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div
                  role="alert"
                  className={`flex shrink-0 items-center gap-2 border-t px-3 py-2 text-xs ${
                    moderationWarning
                      ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-950 dark:bg-amber-950/40 dark:text-amber-200'
                      : 'border-red-100 bg-red-50 text-red-700 dark:border-red-950 dark:bg-red-950/40 dark:text-red-200'
                  }`}
                >
                  <span className="min-w-0 flex-1">{t(error)}</span>
                  {pendingHistory && <button type="button" onClick={() => void retry()} disabled={sending || cooldownSeconds > 0} className="shrink-0 font-bold underline disabled:opacity-50">{t('Thử lại')}</button>}
                </div>
              )}

              <form onSubmit={(event) => void submitMessage(event)} className="shrink-0 border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-900 sm:pb-3">
                <div className="mb-2 grid grid-cols-2 gap-2" role="group" aria-label={t('Chọn AI cho ExaBot')}>
                  <button
                    type="button"
                    onClick={() => setProvider('GROQ')}
                    aria-pressed={provider === 'GROQ'}
                    title={t('Groq · ưu tiên phản hồi nhanh')}
                    disabled={sending}
                    className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60 ${
                      provider === 'GROQ'
                        ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    <Icon name="zap" size={17} className="shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">{t('Groq · Nhanh')}</span>
                      <span className="block text-[10px] opacity-75">{t('Trả lời gọn')}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('GEMINI')}
                    aria-pressed={provider === 'GEMINI'}
                    title={t('Gemini · ưu tiên giải thích chi tiết')}
                    disabled={sending}
                    className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60 ${
                      provider === 'GEMINI'
                        ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    <Icon name="exaAi" size={17} className="shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">{t('Gemini · Chi tiết')}</span>
                      <span className="block text-[10px] opacity-75">{t('Giải thích từng bước')}</span>
                    </span>
                  </button>
                </div>
                <p className="mb-2 px-1 text-[10px] text-slate-400">
                  {t('AI đã chọn được ưu tiên; ExaBot tự chuyển sang AI khác nếu gặp lỗi.')}
                </p>
                <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:ring-blue-950">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value.slice(0, MAX_INPUT_LENGTH))}
                    onKeyDown={handleKeyDown}
                    placeholder={t('Nhắn tin cho EXA AI...')}
                    aria-label={t('Tin nhắn của bạn')}
                    rows={1}
                    maxLength={MAX_INPUT_LENGTH}
                    disabled={sending}
                    className="max-h-32 min-h-9 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending || cooldownSeconds > 0}
                    aria-label={t('Gửi tin nhắn')}
                    title={t('Gửi')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                  >
                    <Icon name="send" size={16} />
                  </button>
                </div>
                <div className="mt-1.5 flex justify-between px-1 text-[10px] text-slate-400">
                  <span role="status" aria-live="polite">
                    {sending
                      ? t('Đang chờ ExaBot phản hồi...')
                      : cooldownSeconds > 0
                      ? chatBanned
                        ? t('Chat bị khóa · còn {{time}}.', { time: formatCountdown(cooldownSeconds) })
                        : t('Có thể gửi câu hỏi tiếp theo sau {{seconds}} giây.', { seconds: cooldownSeconds })
                      : t('Enter để gửi · Shift+Enter xuống dòng')}
                  </span>
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
