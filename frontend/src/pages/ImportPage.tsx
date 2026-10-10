import { useState } from 'react';
import type { DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Select } from '../components/Input';
import { useToast } from '../components/Toast';
import { MathText } from '../components/MathText';
import { importApi } from '../api/import';
import type { ImportMode, ImportPreview, ParsedQuestion } from '../api/import';
import { extractError } from '../api/client';
import { SUBJECTS, DIFFICULTY_LABELS } from '../lib/utils';

const IMPORT_WAIT_MS = 120_000;
const IMPORT_POLL_INTERVAL_MS = 1_500;
const QUESTION_TYPES: Record<string, string> = {
  MCQ: 'Trắc nghiệm',
  TRUE_FALSE: 'Đúng / Sai',
  SHORT_ANSWER: 'Trả lời ngắn',
  ESSAY: 'Tự luận',
};
const SUPPORTED_EXTENSIONS = ['docx', 'pdf', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'webp'];

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('EXTRACT');
  const [questionCount, setQuestionCount] = useState(10);
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState(12);
  const [unit, setUnit] = useState('');
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const navigate = useNavigate();

  const chooseFile = (candidate?: File) => {
    if (!candidate) return;
    const extension = candidate.name.split('.').pop()?.toLowerCase();
    if (!extension || !SUPPORTED_EXTENSIONS.includes(extension)) {
      toast('Định dạng không hỗ trợ', 'Chỉ nhận DOCX, PDF, XLSX, XLS, PNG, JPG hoặc WEBP.', 'warn');
      return;
    }
    if (candidate.size > 20 * 1024 * 1024) {
      toast('File quá lớn', 'Dung lượng file tối đa là 20MB.', 'warn');
      return;
    }
    if (['png', 'jpg', 'jpeg', 'webp'].includes(extension) && candidate.size > 15 * 1024 * 1024) {
      toast('Ảnh quá lớn', 'Dung lượng ảnh gửi đến AI tối đa 15MB.', 'warn');
      return;
    }
    setFile(candidate);
    setPreview(null);
    setSelected(new Set());
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  };

  const waitForJob = async (jobId: number) => {
    const deadline = Date.now() + IMPORT_WAIT_MS;
    let latest = await importApi.getPreview(jobId);
    setPreview(latest);
    while (latest.status !== 'REVIEW' && latest.status !== 'FAILED' && Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, IMPORT_POLL_INTERVAL_MS));
      latest = await importApi.getPreview(jobId);
      setPreview(latest);
    }
    if (latest.status === 'REVIEW') {
      setSelected(new Set(latest.questions.map((_, idx) => idx)));
    }
    return latest;
  };

  const handleUpload = async () => {
    if (!file && !content.trim()) {
      toast('Chưa có nội dung', 'Hãy chọn tệp hoặc nhập nội dung cần xử lý.', 'warn');
      return;
    }
    setUploading(true);
    try {
      const jobId = await importApi.upload(file, content, subject, grade, importMode, questionCount);
      setPreview({
        jobId,
        originalName: file?.name || 'Nội dung nhập tay',
        status: 'UPLOADED',
        totalFound: 0,
        questions: [],
      });
      toast('Đang xử lý', importMode === 'GENERATE'
        ? 'AI đang đọc nội dung và tạo câu hỏi...'
        : 'AI đang phân tích tài liệu...', 'info');
      const latest = await waitForJob(jobId);
      if (latest.status === 'FAILED') {
        toast('AI xử lý thất bại', latest.errorMessage || 'Vui lòng thử lại với tệp khác.', 'error');
      } else if (latest.status === 'REVIEW') {
        toast('Hoàn tất', `${importMode === 'GENERATE' ? 'Đã tạo' : 'Tìm thấy'} ${latest.totalFound} câu hỏi`, 'success');
      } else {
        toast('Đang xử lý', 'Tệp cần thêm thời gian. Bạn có thể tải lại trạng thái sau.', 'warn');
      }
    } catch (err) {
      toast('Lỗi', extractError(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  const updateQuestion = (index: number, updates: Partial<ParsedQuestion>) => {
    setPreview((current) => current
      ? {
          ...current,
          questions: current.questions.map((question, questionIndex) =>
            questionIndex === index ? { ...question, ...updates } : question),
        }
      : current);
  };

  const toggleSelect = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
  };

  const handleSave = async () => {
    if (!preview) return;
    const questions = preview.questions.filter((_, idx) => selected.has(idx));
    if (questions.length === 0) {
      toast('Chưa chọn câu nào', '', 'warn');
      return;
    }
    setSaving(true);
    try {
      const count = await importApi.saveToBank(preview.jobId, questions, subject, grade, unit);
      toast('Đã lưu', `${count} câu hỏi vào ngân hàng`, 'success');
      navigate('/questions');
    } catch (err) {
      toast('Lỗi', extractError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Import đề thi bằng AI</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Đọc ảnh/tài liệu, tách câu hỏi có sẵn hoặc tạo câu hỏi mới từ nội dung
        </p>
      </div>

      {/* Step 1: Upload */}
      {!preview && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="grid md:grid-cols-3 gap-4">
            <Select
              label="Môn học"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              options={SUBJECTS.map((s) => ({ value: s, label: s }))}
            />
            <Select
              label="Khối lớp"
              value={String(grade)}
              onChange={(e) => setGrade(Number(e.target.value))}
              options={[10, 11, 12].map((g) => ({ value: String(g), label: `Lớp ${g}` }))}
            />
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                Chuyên đề (tùy chọn)
              </label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="VD: Hàm số bậc ba"
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setImportMode('EXTRACT')}
              className={`rounded-xl border p-4 text-left transition-colors ${
                importMode === 'EXTRACT'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className="block text-sm font-bold text-slate-900 dark:text-white">
                Tách câu hỏi có sẵn
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Giữ câu hỏi và đáp án tìm thấy trong tài liệu hoặc ảnh.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setImportMode('GENERATE')}
              className={`rounded-xl border p-4 text-left transition-colors ${
                importMode === 'GENERATE'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className="block text-sm font-bold text-slate-900 dark:text-white">
                Tạo câu hỏi từ nội dung
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Không cần có câu hỏi sẵn; AI tạo câu hỏi mới dựa trên nội dung nguồn.
              </span>
            </button>
          </div>

          {importMode === 'GENERATE' && (
            <Select
              label="Số câu hỏi cần tạo"
              value={String(questionCount)}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
              options={[5, 10, 15, 20].map((count) => ({
                value: String(count),
                label: `${count} câu`,
              }))}
            />
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Nội dung nguồn (tùy chọn nếu đã chọn tệp)
            </label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={100000}
              rows={5}
              placeholder={importMode === 'GENERATE'
                ? 'Dán bài học, đoạn văn, ghi chú hoặc kiến thức cần dùng để tạo câu hỏi...'
                : 'Có thể dán thêm nội dung để AI trích xuất câu hỏi...'}
              className="w-full resize-y rounded-xl border border-slate-200 bg-transparent px-3.5 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {content.length.toLocaleString()} / 100.000 ký tự
            </p>
          </div>

          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`block border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              dragging
                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/50'
            }`}
          >
            <input
              type="file"
              accept=".docx,.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
              className="hidden"
              disabled={uploading}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Icon name="upload" size={28} />
            </div>
            <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">
              {file ? file.name : 'Kéo thả file vào đây hoặc bấm để chọn'}
            </div>
            <div className="text-xs text-slate-500">
              Hỗ trợ DOCX, PDF (kể cả PDF scan), XLSX, XLS, PNG, JPG và WEBP. Tệp tối đa 20MB, ảnh tối đa 15MB.
            </div>
          </label>

          <Button
            variant="primary"
            size="lg"
            block
            loading={uploading}
            onClick={handleUpload}
            icon={<Icon name="sparkle" size={18} />}
          >
            {uploading ? 'AI đang xử lý...' : importMode === 'GENERATE'
              ? 'Tạo câu hỏi bằng AI'
              : 'Bắt đầu import bằng AI'}
          </Button>
          {uploading && (
            <div
              role="progressbar"
              aria-label="Đang phân tích tài liệu"
              className="h-1.5 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950"
            >
              <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-600" />
            </div>
          )}
        </div>
      )}

      {/* Step 2: Preview */}
      {preview && preview.status === 'REVIEW' && preview.questions.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-6 text-center">
          <h3 className="font-bold text-amber-800 dark:text-amber-300">
            {importMode === 'GENERATE' ? 'AI chưa tạo được câu hỏi' : 'AI chưa tìm thấy câu hỏi'}
          </h3>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-200">
            {importMode === 'GENERATE'
              ? 'Nội dung nguồn có thể chưa đủ thông tin để tạo câu hỏi chính xác. Hãy bổ sung nội dung rõ hơn hoặc chọn tệp khác.'
              : 'Kiểm tra nội dung tệp có thể đọc được rồi thử lại. Với ảnh hoặc PDF scan, hãy bảo đảm chữ rõ và không bị nghiêng.'}
          </p>
          <Button variant="ghost" className="mt-3" onClick={() => setPreview(null)}>
            Chọn tệp khác
          </Button>
        </div>
      )}

      {preview && preview.status === 'REVIEW' && preview.questions.length > 0 && (
        <>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                <Icon name="check" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {importMode === 'GENERATE' ? 'Đã tạo' : 'Tìm thấy'} {preview.totalFound} câu hỏi
                </h3>
                <p className="text-xs text-slate-500">{preview.originalName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setSelected(
                  selected.size === preview.questions.length
                    ? new Set()
                    : new Set(preview.questions.map((_, idx) => idx)),
                )}
              >
                {selected.size === preview.questions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                ← Upload lại
              </Button>
              <Button
                variant="primary"
                loading={saving}
                disabled={selected.size === 0}
                onClick={handleSave}
                icon={<Icon name="save" size={16} />}
              >
                Lưu {selected.size} câu vào ngân hàng
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {preview.questions.map((q, idx) => (
              <div
                key={idx}
                className={`bg-white dark:bg-slate-900 rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                  selected.has(idx)
                    ? 'border-blue-500 shadow-lg shadow-blue-500/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    onClick={() => toggleSelect(idx)}
                    role="checkbox"
                    aria-checked={selected.has(idx)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleSelect(idx);
                      }
                    }}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-none mt-0.5 cursor-pointer ${
                      selected.has(idx)
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {selected.has(idx) && <Icon name="check" size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs font-bold text-slate-400">Câu {idx + 1}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold">
                        {DIFFICULTY_LABELS[q.difficulty] || q.difficulty}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">
                        {QUESTION_TYPES[q.type] || q.type}
                      </span>
                    </div>
                    <label className="block mb-3" onClick={(event) => event.stopPropagation()}>
                      <span className="sr-only">Nội dung câu hỏi {idx + 1}</span>
                      <textarea
                        value={q.content}
                        onChange={(event) => updateQuestion(idx, { content: event.target.value })}
                        onClick={(event) => event.stopPropagation()}
                        className="w-full resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                      />
                      <MathText className="mt-2 block text-sm text-slate-700 dark:text-slate-200">
                        {q.content}
                      </MathText>
                    </label>
                    {q.options && q.options.length > 0 && (
                      <div className="space-y-1.5">
                        {q.options.map((opt, i) => {
                          const letter = String.fromCharCode(65 + i);
                          const isCorrect = q.correctAnswer === letter;
                          return (
                            <label
                              key={i}
                              className={`text-xs px-3 py-2 rounded-lg ${
                                isCorrect
                                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600'
                              }`}
                            >
                              <span className="mr-2 font-semibold">{letter}.</span>
                              <input
                                value={opt}
                                onChange={(event) => updateQuestion(idx, {
                                  options: q.options.map((option, optionIndex) =>
                                    optionIndex === i ? event.target.value : option),
                                })}
                                onClick={(event) => event.stopPropagation()}
                                className="w-[calc(100%-2rem)] bg-transparent outline-none"
                              />
                              {isCorrect && ' ✓'}
                              <MathText className="mt-1 block pl-6 text-xs">
                                {opt}
                              </MathText>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {q.options.length > 0 && (
                      <label className="mt-3 block max-w-xs text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Đáp án đúng
                        <select
                          value={q.correctAnswer || ''}
                          onChange={(event) => updateQuestion(idx, { correctAnswer: event.target.value || null })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="">Chưa xác định</option>
                          {q.options.map((_, optionIndex) => {
                            const letter = String.fromCharCode(65 + optionIndex);
                            return <option key={letter} value={letter}>{letter}</option>;
                          })}
                        </select>
                      </label>
                    )}
                    {q.explanation && (
                      <p className="mt-3 text-xs text-slate-500">
                        <strong>Giải thích xem trước:</strong>{' '}
                        <MathText>{q.explanation}</MathText>
                      </p>
                    )}
                    {(q.type === 'SHORT_ANSWER' || q.type === 'ESSAY' || q.answerText !== null) && (
                      <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Đáp án / gợi ý trả lời
                        <textarea
                          value={q.answerText || ''}
                          onChange={(event) => updateQuestion(idx, { answerText: event.target.value || null })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm font-normal dark:border-slate-700"
                        />
                      </label>
                    )}
                    {q.explanation && (
                      <label className="mt-3 block text-xs font-semibold text-amber-700">
                        Giải thích
                        <textarea
                          value={q.explanation}
                          onChange={(event) => updateQuestion(idx, { explanation: event.target.value || null })}
                          className="mt-1 w-full rounded-lg bg-amber-50 p-3 text-xs font-normal"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Step 3: Failed */}
      {preview && preview.status === 'FAILED' && (
        <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-3">
            <Icon name="alert" size={28} />
          </div>
          <h3 className="font-bold text-red-700 dark:text-red-400 mb-1">Xử lý thất bại</h3>
          <p className="text-sm text-red-600 mb-4">{preview.errorMessage}</p>
          <Button variant="ghost" onClick={() => setPreview(null)}>
            Thử lại
          </Button>
        </div>
      )}
      {preview && preview.status !== 'REVIEW' && preview.status !== 'FAILED' && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-6 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <h3 className="font-bold text-blue-700 dark:text-blue-300">Đang xử lý tệp</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Trạng thái: {preview.status}. Bạn có thể kiểm tra lại sau.</p>
          <Button
            variant="ghost"
            className="mt-3"
            loading={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                const latest = await waitForJob(preview.jobId);
                if (latest.status === 'REVIEW') {
                  toast('Hoàn tất', `Tìm thấy ${latest.totalFound} câu hỏi`, 'success');
                } else if (latest.status === 'FAILED') {
                  toast('AI xử lý thất bại', latest.errorMessage || 'Vui lòng thử lại với tệp khác.', 'error');
                } else {
                  toast('Đang xử lý', 'Tệp vẫn đang được xử lý. Hãy thử tải lại sau.', 'warn');
                }
              } catch (error) {
                toast('Không tải được bản xem trước', extractError(error), 'error');
              } finally {
                setRefreshing(false);
              }
            }}
          >
            Kiểm tra tiến trình
          </Button>
        </div>
      )}
    </div>
  );
}