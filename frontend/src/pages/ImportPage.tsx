import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { QuestionImage } from '../components/QuestionImage';
import { Select } from '../components/Input';
import { SubjectInput } from '../components/SubjectInput';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { MathText } from '../components/MathText';
import { questionApi } from '../api/question';
import { importApi } from '../api/import';
import type { ImportAiProvider, ImportMode, ImportPreview, ParsedQuestion } from '../api/import';
import { extractError } from '../api/client';
import { DIFFICULTY_LABELS } from '../lib/utils';
import { useLanguage } from '../i18n';

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
  const [provider, setProvider] = useState<ImportAiProvider>('GEMINI');
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
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(null);
  const uploadedSourceImage = useRef<{ file: File; url: string } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
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
        setPollError(t('Không thể khôi phục phiên import cũ. Hãy kiểm tra đăng nhập và thử lại.'));
      });
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey, t]);

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
          toast(t('Đã xử lý xong'), t('Có {{count}} câu để xem lại trước khi lưu.', { count: next.questions.length }), 'success');
        } else if (next.status === 'FAILED') {
          toast(t('Import chưa thành công'), next.errorMessage || t('Hãy thử lại.'), 'error');
        }
      } catch (error) {
        if (active) setPollError(extractError(error));
      }
      if (active) timer = setTimeout(poll, IMPORT_POLL_INTERVAL_MS);
    };
    timer = setTimeout(poll, IMPORT_POLL_INTERVAL_MS);
    return () => { active = false; clearTimeout(timer); };
  }, [activeJobId, activeJobStatus, t, toast]);

  const resetImport = () => {
    sessionStorage.removeItem(storageKey);
    setPreview(null);
    setSelected(new Set());
    setPollError('');
    setFile(null);
    uploadedSourceImage.current = null;
  };


  const chooseFile = (candidate?: File) => {
    if (!candidate) return;
    const extension = candidate.name.split('.').pop()?.toLowerCase();
    if (!extension || !SUPPORTED_EXTENSIONS.includes(extension)) {
      toast(t('Định dạng không hỗ trợ'), t('Chỉ nhận TXT, DOCX, PDF, XLSX, XLS, PNG, JPG hoặc WEBP.'), 'warn');
      return;
    }
    if (candidate.size > 20 * 1024 * 1024) {
      toast(t('File quá lớn'), t('Dung lượng file tối đa là 20MB.'), 'warn');
      return;
    }
    if (['png', 'jpg', 'jpeg', 'webp'].includes(extension) && candidate.size > 15 * 1024 * 1024) {
      toast(t('Ảnh quá lớn'), t('Dung lượng ảnh gửi đến AI tối đa 15MB.'), 'warn');
      return;
    }
    setFile(candidate);
    setPreview(null);
    setSelected(new Set());
    uploadedSourceImage.current = null;
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!subject.trim()) {
      toast(t('Thiếu môn học'), t('Hãy nhập môn học cho câu hỏi cần import.'), 'warn');
      return;
    }
    if (!file && !content.trim()) {
      toast(t('Chưa có nội dung'), t('Hãy chọn tệp hoặc nhập nội dung cần xử lý.'), 'warn');
      return;
    }
    if (uploading) return;
    setUploading(true);
    try {
      const jobId = await importApi.upload(
        file, content, subject.trim(), grade, importMode, questionCount, provider,
      );
      setPreview({
        jobId,
        originalName: file?.name || 'Nội dung nhập tay',
        status: 'UPLOADED',
        totalFound: 0,
        questions: [],
      });
      toast(t('Đang xử lý'), t(importMode === 'GENERATE'
        ? 'AI đang đọc nội dung và tạo câu hỏi...'
        : 'AI đang phân tích tài liệu...'), 'info');
      sessionStorage.setItem(storageKey, JSON.stringify({
        id: jobId, mode: importMode, subject, grade, unit,
      }));
      setPollError('');
      // Status is refreshed in the background; the page remains responsive.

    } catch (err) {
      toast(t('Lỗi'), extractError(err), 'error');
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

  const uploadQuestionImage = async (index: number, imageFile: File) => {
    if (imageFile.size > 5 * 1024 * 1024) {
      toast(t('Ảnh quá lớn'), t('Ảnh câu hỏi tối đa 5 MB.'), 'warn');
      return;
    }
    setUploadingImageKey(`question-${index}`);
    try {
      const imageUrl = await questionApi.uploadImage(imageFile);
      updateQuestion(index, { imageUrl });
    } catch (error) {
      toast(t('Không tải được ảnh câu hỏi'), extractError(error), 'error');
    } finally {
      setUploadingImageKey(null);
    }
  };

  const attachScannedImage = async (index: number) => {
    if (!file || uploadingImageKey) return;
    if (file.size > 5 * 1024 * 1024) {
      toast(t('Ảnh gốc quá lớn để đính kèm'), t('Ảnh dùng làm hình minh họa tối đa 5 MB. Bạn có thể chọn ảnh nhỏ hơn ở câu hỏi.'), 'warn');
      return;
    }
    setUploadingImageKey(`question-${index}`);
    try {
      const cached = uploadedSourceImage.current;
      const imageUrl = cached?.file === file ? cached.url : await questionApi.uploadImage(file);
      uploadedSourceImage.current = { file, url: imageUrl };
      updateQuestion(index, { imageUrl });
    } catch (error) {
      toast(t('Không đính kèm được ảnh đã quét'), extractError(error), 'error');
    } finally {
      setUploadingImageKey(null);
    }
  };

  const uploadOptionImage = async (questionIndex: number, optionIndex: number, imageFile: File) => {
    if (imageFile.size > 5 * 1024 * 1024) {
      toast(t('Ảnh quá lớn'), t('Ảnh phương án tối đa 5 MB.'), 'warn');
      return;
    }
    const key = `option-${questionIndex}-${optionIndex}`;
    setUploadingImageKey(key);
    try {
      const imageUrl = await questionApi.uploadImage(imageFile);
      const currentImages = preview?.questions[questionIndex]?.optionImages ?? [];
      const optionImages = Array.from({ length: preview?.questions[questionIndex]?.options.length ?? 0 }, (_, index) =>
        index === optionIndex ? imageUrl : currentImages[index] ?? '');
      updateQuestion(questionIndex, { optionImages });
    } catch (error) {
      toast(t('Không tải được ảnh phương án'), extractError(error), 'error');
    } finally {
      setUploadingImageKey(null);
    }
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
      toast(t('Chưa chọn câu nào'), '', 'warn');
      return;
    }
    const invalidIndex = preview.questions.findIndex((q, index) => selected.has(index)
      && (!q.content.trim() || (q.type === 'MCQ' && (q.options?.filter((opt) => opt.trim()).length ?? 0) < 2)));
    if (invalidIndex !== -1) {
      toast(t('Câu hỏi chưa hợp lệ'), t('Kiểm tra nội dung và phương án của câu {{number}}.', { number: invalidIndex + 1 }), 'warn');
      return;
    }
    setSaving(true);
    try {
      const count = await importApi.saveToBank(preview.jobId, questions, subject, grade, unit);
      toast(t('Đã lưu'), t('{{count}} câu hỏi vào ngân hàng', { count }), 'success');
      sessionStorage.removeItem(storageKey);
      navigate('/questions');
    } catch (err) {
      toast(t('Lỗi'), extractError(err), 'error');
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
            <h1 className="exa-page-title text-slate-900 dark:text-white">{t('Import đề thi bằng AI')}</h1>
            <p className="exa-page-subtitle mt-1">{t('Tải tài liệu, trích xuất hoặc sinh câu hỏi, kiểm tra đáp án và lưu vào ngân hàng.')}</p>
          </div>
        </div>
        <ol aria-label={t('Các bước import')} className="relative mt-6 grid grid-cols-3 gap-2 text-xs sm:text-sm">
          {['01 · Cung cấp nội dung', '02 · AI xử lý', '03 · Rà soát & lưu'].map((label, index) => (
            <li key={label} className={`rounded-xl border px-3 py-2.5 text-center font-semibold ${
              (!preview && index === 0) || (preview && preview.status !== 'REVIEW' && index === 1) || preview?.status === 'REVIEW' && index === 2
                ? 'border-blue-500/40 bg-blue-50 text-blue-900 dark:bg-blue-500/15 dark:text-blue-200'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
            }`}>{t(label)}</li>
          ))}
        </ol>
      </header>
      {pollError && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">{pollError}</div>}

      {/* Step 1: Upload */}
      {!preview && (
        <div className="exa-card p-4 sm:p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <SubjectInput value={subject} onChange={setSubject} required />
            <Select
              label={t('Khối lớp')}
              value={String(grade)}
              onChange={(e) => setGrade(Number(e.target.value))}
              options={[10, 11, 12].map((g) => ({ value: String(g), label: t('Lớp {{grade}}', { grade: g }) }))}
            />
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                {t('Chuyên đề (tùy chọn)')}
              </label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t('VD: Hàm số bậc ba')}
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
                {t('Tách câu hỏi có sẵn')}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {t('Giữ câu hỏi và đáp án tìm thấy trong tài liệu hoặc ảnh.')}
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
                {t('Tạo câu hỏi từ nội dung')}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {t('AI xử lý ghi chú, đoạn văn, bảng, dữ kiện, chủ đề ngắn hoặc yêu cầu tự nhiên; không cần theo mẫu đề thi hay có câu hỏi sẵn.')}
              </span>
            </button>
          </div>

          {importMode === 'GENERATE' && (
            <Select
              label={t('Số câu hỏi cần tạo')}
              value={String(questionCount)}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
              options={[5, 10, 15, 20].map((count) => ({
                value: String(count),
                label: t('{{count}} câu', { count }),
              }))}
            />
          )}

          <div>
            <div className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              {t('AI xử lý import')}
            </div>
            <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={t('Chọn AI cho import')}>
              <button
                type="button"
                onClick={() => setProvider('GROQ')}
                aria-pressed={provider === 'GROQ'}
                className={`rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
                  provider === 'GROQ'
                    ? 'border-blue-500 bg-blue-50 text-blue-950 shadow-sm dark:bg-blue-500/15 dark:text-blue-100'
                    : 'border-slate-300 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50/60 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <Icon name="zap" size={17} />
                  {t('Groq · Nhanh')}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {t('Ưu tiên xử lý nhanh; ảnh/PDF scan cần model Groq hỗ trợ Vision.')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setProvider('GEMINI')}
                aria-pressed={provider === 'GEMINI'}
                className={`rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
                  provider === 'GEMINI'
                    ? 'border-blue-500 bg-blue-50 text-blue-950 shadow-sm dark:bg-blue-500/15 dark:text-blue-100'
                    : 'border-slate-300 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50/60 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <Icon name="exaAi" size={17} />
                  {t('Gemini · Chi tiết')}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {t('Phân tích sâu câu hỏi, đáp án, công thức và nội dung hình ảnh.')}
                </span>
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {t('AI đã chọn được ưu tiên; nếu gặp lỗi, hệ thống tự chuyển sang AI còn lại.')}
              {' '}{t('Khi tài liệu không ghi đáp án, AI sẽ tự giải và điền đáp án nếu đủ dữ kiện.')}
              {' '}{t('Hãy duyệt, sửa nếu cần trước khi lưu.')}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              {importMode === 'GENERATE'
                ? t('Nội dung, chủ đề hoặc yêu cầu cho AI (tùy chọn nếu đã chọn tệp)')
                : t('Nội dung nguồn (tùy chọn nếu đã chọn tệp)')}
            </label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={100000}
              rows={5}
              placeholder={importMode === 'GENERATE'
                ? t('Dán bất kỳ nội dung nào hoặc nhập yêu cầu tự nhiên, ví dụ: “Tạo câu hỏi về quang hợp lớp 10” — không cần theo mẫu đề thi...')
                : t('Có thể dán thêm nội dung để AI trích xuất câu hỏi...')}
              className="exa-field w-full resize-y px-3.5 py-3 text-sm min-h-36"
            />
            {importMode === 'GENERATE' && (
              <p className="mt-1 text-xs text-slate-500">
                {t('Nếu chỉ nhập chủ đề hoặc yêu cầu ngắn, AI vẫn có thể tự biên soạn câu hỏi theo môn học và khối lớp đã chọn.')}
              </p>
            )}
            <p className="mt-1 text-right text-xs text-slate-400">
              {content.length.toLocaleString()} / {t('100.000 ký tự')}
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
              aria-label={t('Chọn tệp để import')}
              className="sr-only"
              disabled={uploading}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Icon name="upload" size={28} />
            </div>
            <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">
              {file ? file.name : t('Kéo thả file vào đây hoặc bấm để chọn')}
            </div>
            <div className="text-xs text-slate-500">
            {t('Hỗ trợ TXT, DOCX, PDF (kể cả PDF scan), XLSX, XLS, PNG, JPG và WEBP. Tệp tối đa 20MB, ảnh tối đa 15MB.')}
            </div>
          </label>

          {file && <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
            <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">{file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
            <button type="button" onClick={() => setFile(null)} className="shrink-0 rounded-lg px-3 py-2 font-semibold text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-950" aria-label={t('Bỏ tệp đã chọn')}>{t('Bỏ tệp')}</button>
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
            {t(uploading ? 'AI đang xử lý...' : importMode === 'GENERATE'
              ? 'Tạo câu hỏi bằng AI'
              : 'Bắt đầu import bằng AI')}
          </Button>
          {uploading && (
            <div
              role="progressbar"
              aria-label={t('Đang phân tích tài liệu')}
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
            {t(importMode === 'GENERATE' ? 'AI chưa tạo được câu hỏi' : 'AI chưa tìm thấy câu hỏi')}
          </h3>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-200">
            {importMode === 'GENERATE'
              ? t('Nội dung nguồn có thể chưa đủ thông tin để tạo câu hỏi chính xác. Hãy bổ sung nội dung rõ hơn hoặc chọn tệp khác.')
              : t('Kiểm tra nội dung tệp có thể đọc được rồi thử lại. Với ảnh hoặc PDF scan, hãy bảo đảm chữ rõ và không bị nghiêng.')}
          </p>
          <Button variant="ghost" className="mt-3" onClick={resetImport}>
            {t('Chọn tệp khác')}
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
                  {t(importMode === 'GENERATE' ? 'Đã tạo' : 'Tìm thấy')} {t('{{count}} câu hỏi', { count: preview.totalFound })}
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
                {t(selected.size === preview.questions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả')}
              </Button>
              <Button variant="ghost" onClick={resetImport}>
                ← {t('Upload lại')}
              </Button>
              <Button
                variant="primary"
                loading={saving}
                disabled={selected.size === 0}
                onClick={handleSave}
                icon={<Icon name="save" size={16} />}
              >
                {t('Lưu {{count}} câu vào ngân hàng', { count: selected.size })}
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
                      <span className="text-xs font-bold text-slate-400">{t('Câu {{number}}', { number: idx + 1 })}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold">
                        {t(DIFFICULTY_LABELS[q.difficulty] || q.difficulty)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">
                        {t(QUESTION_TYPES[q.type] || q.type)}
                      </span>
                    </div>
                    <div className="mb-3">
                      <MathText className="block whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-900 dark:text-white">
                        {q.content}
                      </MathText>
                      <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                        <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:text-slate-200">
                          {t(uploadingImageKey === `question-${idx}` ? 'Đang tải ảnh...' : q.imageUrl ? 'Đổi ảnh câu hỏi' : 'Thêm ảnh câu hỏi')}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            aria-label={t('Thêm ảnh câu hỏi {{number}}', { number: idx + 1 })}
                            disabled={uploadingImageKey !== null || saving}
                            onChange={(event) => {
                              const imageFile = event.target.files?.[0];
                              if (imageFile) void uploadQuestionImage(idx, imageFile);
                              event.target.value = '';
                            }}
                            className="sr-only"
                          />
                        </label>
                        {file && /\.(png|jpe?g|webp)$/i.test(file.name) && (
                          <button
                            type="button"
                            disabled={uploadingImageKey !== null || saving}
                            onClick={() => void attachScannedImage(idx)}
                            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                          >
                            {t(uploadingImageKey === `question-${idx}` ? 'Đang đính kèm...' : 'Dùng ảnh đã quét')}
                          </button>
                        )}
                        {q.imageUrl && (
                          <button type="button" onClick={() => updateQuestion(idx, { imageUrl: null })} className="rounded-lg px-2 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                            {t('Gỡ ảnh câu hỏi')}
                          </button>
                        )}
                      </div>
                      {q.imageUrl && <QuestionImage src={q.imageUrl} alt={t('Hình minh họa câu {{number}}', { number: idx + 1 })} className="mt-2" />}
                      <details className="mt-2 text-xs text-slate-500" onClick={(event) => event.stopPropagation()}>
                        <summary className="w-fit cursor-pointer select-none">{t('Sửa nội dung câu hỏi')}</summary>
                        <textarea
                          aria-label={t('Nội dung câu hỏi {{number}}', { number: idx + 1 })}
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
                                {isCorrect && <span aria-label={t('Đáp án đúng')}>✓</span>}
                              </div>
                              <details className="mt-1 text-xs opacity-75" onClick={(event) => event.stopPropagation()}>
                                <summary className="w-fit cursor-pointer select-none">{t('Sửa phương án {{letter}}', { letter })}</summary>
                                <textarea
                                  aria-label={t('Phương án {{letter}}, câu {{number}}', { letter, number: idx + 1 })}
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
                              {q.type === 'MCQ' && (
                                <>
                                  <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                                    <label className="cursor-pointer rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium hover:border-blue-400 dark:border-slate-700">
                                      {t(uploadingImageKey === `option-${idx}-${i}` ? 'Đang tải...' : q.optionImages?.[i] ? 'Đổi ảnh {{letter}}' : 'Thêm ảnh {{letter}}', { letter })}
                                      <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        aria-label={t('Thêm ảnh phương án {{letter}}, câu {{number}}', { letter, number: idx + 1 })}
                                        disabled={uploadingImageKey !== null || saving}
                                        onChange={(event) => {
                                          const imageFile = event.target.files?.[0];
                                          if (imageFile) void uploadOptionImage(idx, i, imageFile);
                                          event.target.value = '';
                                        }}
                                        className="sr-only"
                                      />
                                    </label>
                                    {q.optionImages?.[i] && (
                                      <button
                                        type="button"
                                        onClick={() => updateQuestion(idx, {
                                          optionImages: q.optionImages?.map((image, imageIndex) => imageIndex === i ? '' : image),
                                        })}
                                        className="rounded-md px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                      >
                                        {t('Gỡ ảnh')}
                                      </button>
                                    )}
                                  </div>
                                  {q.optionImages?.[i] && <QuestionImage src={q.optionImages[i]} alt={t('Hình phương án {{letter}}, câu {{number}}', { letter, number: idx + 1 })} className="mt-2" />}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {q.options.length > 0 && (
                      <label className="mt-3 block max-w-xs text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t('Đáp án đúng')}
                        <select
                          value={q.correctAnswer || ''}
                          onChange={(event) => updateQuestion(idx, { correctAnswer: event.target.value || null })}
                          className="exa-field mt-1 w-full px-3 py-2 text-sm"
                        >
                          <option value="">{t('Chưa xác định')}</option>
                          {q.options.map((_, optionIndex) => {
                            const letter = String.fromCharCode(65 + optionIndex);
                            return <option key={letter} value={letter}>{letter}</option>;
                          })}
                        </select>
                      </label>
                    )}
                    {q.explanation && (
                      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        <strong>{t('Giải thích xem trước')}:</strong>{' '}
                        <MathText>{q.explanation}</MathText>
                      </p>
                    )}
                    {(q.type === 'SHORT_ANSWER' || q.type === 'ESSAY' || q.answerText !== null) && (
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {t('Đáp án / gợi ý trả lời')}
                          <textarea
                            value={q.answerText || ''}
                            onChange={(event) => updateQuestion(idx, { answerText: event.target.value || null })}
                            className="exa-field mt-1 w-full px-3 py-2 text-sm font-normal"
                          />
                        </label>
                        {q.answerText && (
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                            {t('Xem trước')}: <MathText>{q.answerText}</MathText>
                          </p>
                        )}
                      </div>
                    )}
                    {q.explanation && (
                      <details className="mt-3 text-xs font-semibold text-amber-700" onClick={(event) => event.stopPropagation()}>
                        <summary className="w-fit cursor-pointer select-none">{t('Sửa giải thích')}</summary>
                        <textarea
                          aria-label={t('Giải thích câu {{number}}', { number: idx + 1 })}
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
          <h3 className="font-bold text-red-700 dark:text-red-400 mb-1">{t('Xử lý thất bại')}</h3>
          <p className="text-sm text-red-600 mb-4">{preview.errorMessage}</p>
          <Button variant="ghost" onClick={resetImport}>
            {t('Thử lại')}
          </Button>
        </div>
      )}
      {preview && preview.status !== 'REVIEW' && preview.status !== 'FAILED' && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-6 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <h3 className="font-bold text-blue-700 dark:text-blue-300">{t('Đang xử lý tệp')}</h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{t(STATUS_LABELS[preview.status] || preview.status)}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('Tiến trình tự cập nhật. Có thể mở trang khác hoặc tải lại trang mà không mất mã phiên.')}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t('Mã phiên')}: #{preview.jobId}</p>
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
                if (latest.status === 'FAILED') toast(t('AI xử lý thất bại'), latest.errorMessage || t('Vui lòng thử lại.'), 'error');
              } catch (error) {
                setPollError(extractError(error));
              } finally {
                setRefreshing(false);
              }
            }}
          >
            {t('Kiểm tra tiến trình')}
          </Button>
          <div><button type="button" onClick={resetImport} className="mt-3 text-sm font-semibold text-blue-800 underline underline-offset-4 dark:text-blue-200">{t('Bắt đầu phiên import khác')}</button></div>
        </div>
      )}
    </div>
  );
}