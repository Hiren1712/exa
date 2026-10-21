import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Select } from '../components/Input';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { MathText } from '../components/MathText';
import { importApi } from '../api/import';
import type { ImportMode, ImportPreview, ParsedQuestion } from '../api/import';
import { extractError } from '../api/client';
import { SUBJECTS, DIFFICULTY_LABELS } from '../lib/utils';

const IMPORT_POLL_INTERVAL_MS = 2_000;
const STATUS_LABELS: Record<string, string> = {
  UPLOADED: 'Đã tiếp nhận tệp',
  EXTRACTING: 'Đang đọc nội dung tài liệu',
  PARSING: 'AI đang phân tích và chuẩn hóa câu hỏi',
  REVIEW: 'Sẵn sàng xem trước',
  FAILED: 'Có lỗi khi xử lý',
};
const QUESTION_TYPES: Record<string, string> = {
  MCQ: 'Trắc nghiệm',
  TRUE_FALSE: 'Đúng / Sai',
  SHORT_ANSWER: 'Trả lời ngắn',
  ESSAY: 'Tự luận',
};
const SUPPORTED_EXTENSIONS = ['txt', 'docx', 'pdf', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'webp'];

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('GENERATE');
  const [questionCount, setQuestionCount] = useState(10);
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState(12);
  const [unit, setUnit] = useState('');
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pollError, setPollError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const storageKey = `exa-import-active-${user?.id ?? 'guest'}`;
  const navigate = useNavigate();

  // A running job remains resumable after a refresh without storing the uploaded file
  // or any source material in browser storage.
  useEffect(() => {
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const job = JSON.parse(stored) as { id: number; mode: ImportMode; subject: string; grade: number; unit: string };
      if (!Number.isSafeInteger(job.id) || job.id <= 0) throw new Error('Invalid job');
      setImportMode(job.mode === 'EXTRACT' ? 'EXTRACT' : 'GENERATE');
      setSubject(job.subject);
      setGrade(job.grade);
      setUnit(job.unit || '');
      importApi.getPreview(job.id).then((next) => {
        if (next.status === 'IMPORTED') {
          sessionStorage.removeItem(storageKey);
          return;
        }
        setPreview(next);
        if (next.status === 'REVIEW') setSelected(new Set(next.questions.map((_, index) => index)));
      }).catch(() => {
        sessionStorage.removeItem(storageKey);
        setPollError('Không thể khôi phục phiên import cũ. Hãy kiểm tra đăng nhập và thử lại.');
      });
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  // Poll in the background, never block the upload button for minutes.
  const activeJobId = preview?.jobId;
  const activeJobStatus = preview?.status;
  useEffect(() => {
    if (!activeJobId || !activeJobStatus || !['UPLOADED', 'EXTRACTING', 'PARSING'].includes(activeJobStatus)) return;
    const jobId = activeJobId;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await importApi.getPreview(jobId);
        if (!active) return;
        setPollError('');
        setPreview(next);
        if (next.status === 'REVIEW') {
          setSelected(new Set(next.questions.map((_, index) => index)));
          toast('Đã xử lý xong', `Có ${next.questions.length} câu để xem lại trước khi lưu.`, 'success');
        } else if (next.status === 'FAILED') {
          toast('Import chưa thành công', next.errorMessage || 'Hãy thử lại.', 'error');
        }
      } catch (error) {
        if (active) setPollError(extractError(error));
      }
      if (active) timer = setTimeout(poll, IMPORT_POLL_INTERVAL_MS);
    };
    timer = setTimeout(poll, IMPORT_POLL_INTERVAL_MS);
    return () => { active = false; clearTimeout(timer); };
  }, [activeJobId, activeJobStatus, toast]);

  const resetImport = () => {
    sessionStorage.removeItem(storageKey);
    setPreview(null);
    setSelected(new Set());
    setPollError('');
    setFile(null);
  };


  const chooseFile = (candidate?: File) => {
    if (!candidate) return;
    const extension = candidate.name.split('.').pop()?.toLowerCase();
    if (!extension || !SUPPORTED_EXTENSIONS.includes(extension)) {
      toast('Định dạng không hỗ trợ', 'Chỉ nhận TXT, DOCX, PDF, XLSX, XLS, PNG, JPG hoặc WEBP.', 'warn');
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

  const handleUpload = async () => {
    if (!file && !content.trim()) {
      toast('Chưa có nội dung', 'Hãy chọn tệp hoặc nhập nội dung cần xử lý.', 'warn');
      return;
    }
    if (uploading) return;
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
      sessionStorage.setItem(storageKey, JSON.stringify({
        id: jobId, mode: importMode, subject, grade, unit,
      }));
      setPollError('');
      // Status is refreshed in the background; the page remains responsive.

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
    if (!preview || saving || preview.status !== 'REVIEW') return;
    const questions = preview.questions.filter((_, idx) => selected.has(idx));
    if (questions.length === 0) {
      toast('Chưa chọn câu nào', '', 'warn');
      return;
    }
    const invalidIndex = preview.questions.findIndex((q, index) => selected.has(index)
      && (!q.content.trim() || (q.type === 'MCQ' && (q.options?.filter((opt) => opt.trim()).length ?? 0) < 2)));
    if (invalidIndex !== -1) {
      toast('Câu hỏi chưa hợp lệ', `Kiểm tra nội dung và phương án của câu ${invalidIndex + 1}.`, 'warn');
      return;
    }
    setSaving(true);
    try {
      const count = await importApi.saveToBank(preview.jobId, questions, subject, grade, unit);
      toast('Đã lưu', `${count} câu hỏi vào ngân hàng`, 'success');
      sessionStorage.removeItem(storageKey);
      navigate('/questions');
    } catch (err) {
      toast('Lỗi', extractError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="exa-card relative overflow-hidden p-5 sm:p-7">
        <div aria-hidden="true" className="absolute -right-16 -top-20 size-60 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-white dark:bg-blue-500 dark:text-slate-950 shadow-lg shadow-blue-500/20"><Icon name="wand" size={26} /></div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-blue-700 dark:text-blue-300">EXA • AI WORKSPACE</div>
            <h1 className="exa-page-title text-slate-900 dark:text-white">Import đề thi bằng AI</h1>
            <p className="exa-page-subtitle mt-1">Tải tài liệu, trích xuất hoặc sinh câu hỏi, kiểm tra đáp án và lưu vào ngân hàng.</p>
          </div>
        </div>
        <ol aria-label="Các bước import" className="relative mt-6 grid grid-cols-3 gap-2 text-xs sm:text-sm">
          {['01 · Cung cấp nội dung', '02 · AI xử lý', '03 · Rà soát & lưu'].map((label, index) => (
            <li key={label} className={`rounded-xl border px-3 py-2.5 text-center font-semibold ${
              (!preview && index === 0) || (preview && preview.status !== 'REVIEW' && index === 1) || preview?.status === 'REVIEW' && index === 2
                ? 'border-blue-500/40 bg-blue-50 text-blue-900 dark:bg-blue-500/15 dark:text-blue-200'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
            }`}>{label}</li>
          ))}
        </ol>
      </header>
      {pollError && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">{pollError}</div>}

      {/* Step 1: Upload */}
      {!preview && (
        <div className="exa-card p-4 sm:p-6 space-y-6">
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
                className="exa-field w-full px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setImportMode('EXTRACT')}
              aria-pressed={importMode === 'EXTRACT'}
              className={`rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
                importMode === 'EXTRACT'
                  ? 'border-blue-500 bg-blue-50 text-blue-950 shadow-sm dark:bg-blue-500/15 dark:text-blue-100'
                  : 'border-slate-300 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50/60 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700'
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
              aria-pressed={importMode === 'GENERATE'}
              className={`rounded-xl border p-4 text-left transition-colors ${
                importMode === 'GENERATE'
                  ? 'border-blue-500 bg-blue-50 text-blue-950 shadow-sm dark:bg-blue-500/15 dark:text-blue-100'
                  : 'border-slate-300 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50/60 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <span className="block text-sm font-bold text-slate-900 dark:text-white">
                Tạo câu hỏi từ nội dung
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Gemini xử lý ghi chú, đoạn văn, bảng, dữ kiện, chủ đề ngắn hoặc yêu cầu tự nhiên; không cần theo mẫu đề thi hay có câu hỏi sẵn.
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
              {importMode === 'GENERATE'
                ? 'Nội dung, chủ đề hoặc yêu cầu cho AI (tùy chọn nếu đã chọn tệp)'
                : 'Nội dung nguồn (tùy chọn nếu đã chọn tệp)'}
            </label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={100000}
              rows={5}
              placeholder={importMode === 'GENERATE'
                ? 'Dán bất kỳ nội dung nào hoặc nhập yêu cầu tự nhiên, ví dụ: “Tạo câu hỏi về quang hợp lớp 10” — không cần theo mẫu đề thi...'
                : 'Có thể dán thêm nội dung để AI trích xuất câu hỏi...'}
              className="exa-field w-full resize-y px-3.5 py-3 text-sm min-h-36"
            />
            {importMode === 'GENERATE' && (
              <p className="mt-1 text-xs text-slate-500">
                Nếu chỉ nhập chủ đề hoặc yêu cầu ngắn, AI vẫn có thể tự biên soạn câu hỏi theo môn học và khối lớp đã chọn.
              </p>
            )}
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
              accept=".txt,.docx,.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
              id="exa-import-file"
              aria-label="Chọn tệp để import"
              className="sr-only"
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
              Hỗ trợ TXT, DOCX, PDF (kể cả PDF scan), XLSX, XLS, PNG, JPG và WEBP. Tệp tối đa 20MB, ảnh tối đa 15MB.
            </div>
          </label>

          {file && <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
            <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">{file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
            <button type="button" onClick={() => setFile(null)} className="shrink-0 rounded-lg px-3 py-2 font-semibold text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-950" aria-label="Bỏ tệp đã chọn">Bỏ tệp</button>
          </div>}
          <Button
            variant="primary"
            disabled={!file && !content.trim()}
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
          <Button variant="ghost" className="mt-3" onClick={resetImport}>
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
              <Button variant="ghost" onClick={resetImport}>
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
                    <div className="mb-3">
                      <MathText className="block whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-900 dark:text-white">
                        {q.content}
                      </MathText>
                      <details className="mt-2 text-xs text-slate-500" onClick={(event) => event.stopPropagation()}>
                        <summary className="w-fit cursor-pointer select-none">Sửa nội dung câu hỏi</summary>
                        <textarea
                          aria-label={`Nội dung câu hỏi ${idx + 1}`}
                          value={q.content}
                          onChange={(event) => updateQuestion(idx, { content: event.target.value })}
                          onClick={(event) => event.stopPropagation()}
                          className="mt-2 w-full resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-normal text-slate-900 dark:text-white"
                        />
                      </details>
                    </div>
                    {q.options && q.options.length > 0 && (
                      <div className="space-y-1.5">
                        {q.options.map((opt, i) => {
                          const letter = String.fromCharCode(65 + i);
                          const isCorrect = q.correctAnswer === letter;
                          return (
                            <div
                              key={i}
                              className={`text-sm px-3 py-2 rounded-lg ${
                                isCorrect
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="font-semibold">{letter}.</span>
                                <MathText className="min-w-0 flex-1 whitespace-pre-wrap">
                                  {opt}
                                </MathText>
                                {isCorrect && <span aria-label="Đáp án đúng">✓</span>}
                              </div>
                              <details className="mt-1 text-xs opacity-75" onClick={(event) => event.stopPropagation()}>
                                <summary className="w-fit cursor-pointer select-none">Sửa phương án {letter}</summary>
                                <textarea
                                  aria-label={`Phương án ${letter}, câu ${idx + 1}`}
                                  value={opt}
                                  rows={2}
                                  onChange={(event) => updateQuestion(idx, {
                                    options: q.options.map((option, optionIndex) =>
                                      optionIndex === i ? event.target.value : option),
                                  })}
                                  onClick={(event) => event.stopPropagation()}
                                  className="mt-2 w-full resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-normal text-slate-900 dark:text-white"
                                />
                              </details>
                            </div>
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
                          className="exa-field mt-1 w-full px-3 py-2 text-sm"
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
                      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
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
                          className="exa-field mt-1 w-full px-3 py-2 text-sm font-normal"
                        />
                      </label>
                    )}
                    {q.explanation && (
                      <details className="mt-3 text-xs font-semibold text-amber-700" onClick={(event) => event.stopPropagation()}>
                        <summary className="w-fit cursor-pointer select-none">Sửa giải thích</summary>
                        <textarea
                          aria-label={`Giải thích câu ${idx + 1}`}
                          value={q.explanation}
                          onChange={(event) => updateQuestion(idx, { explanation: event.target.value || null })}
                          onClick={(event) => event.stopPropagation()}
                          className="exa-field mt-2 w-full bg-amber-50 p-3 text-sm font-normal dark:bg-amber-950/30"
                        />
                      </details>
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
          <Button variant="ghost" onClick={resetImport}>
            Thử lại
          </Button>
        </div>
      )}
      {preview && preview.status !== 'REVIEW' && preview.status !== 'FAILED' && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-6 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <h3 className="font-bold text-blue-700 dark:text-blue-300">Đang xử lý tệp</h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{STATUS_LABELS[preview.status] || preview.status}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Tiến trình tự cập nhật. Có thể mở trang khác hoặc tải lại trang mà không mất mã phiên.</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Mã phiên: #{preview.jobId}</p>
          <Button
            variant="ghost"
            className="mt-3"
            loading={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                const latest = await importApi.getPreview(preview.jobId);
                setPreview(latest);
                setPollError('');
                if (latest.status === 'REVIEW') setSelected(new Set(latest.questions.map((_, index) => index)));
                if (latest.status === 'FAILED') toast('AI xử lý thất bại', latest.errorMessage || 'Vui lòng thử lại.', 'error');
              } catch (error) {
                setPollError(extractError(error));
              } finally {
                setRefreshing(false);
              }
            }}
          >
            Kiểm tra tiến trình
          </Button>
          <div><button type="button" onClick={resetImport} className="mt-3 text-sm font-semibold text-blue-800 underline underline-offset-4 dark:text-blue-200">Bắt đầu phiên import khác</button></div>
        </div>
      )}
    </div>
  );
}