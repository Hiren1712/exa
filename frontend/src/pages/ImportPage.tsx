import { useState } from 'react';
import type { DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Select } from '../components/Input';
import { useToast } from '../components/Toast';
import { importApi, ImportPreview } from '../api/import';
import { extractError } from '../api/client';
import { SUBJECTS, DIFFICULTY_LABELS } from '../lib/utils';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState(12);
  const [unit, setUnit] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const navigate = useNavigate();

  const chooseFile = (candidate?: File) => {
    if (!candidate) return;
    const extension = candidate.name.split('.').pop()?.toLowerCase();
    if (!extension || !['docx', 'pdf', 'xlsx', 'xls'].includes(extension)) {
      toast('Định dạng không hỗ trợ', 'Chỉ nhận file DOCX, PDF, XLSX hoặc XLS.', 'warn');
      return;
    }
    if (candidate.size > 20 * 1024 * 1024) {
      toast('File quá lớn', 'Dung lượng file tối đa là 20MB.', 'warn');
      return;
    }
    setFile(candidate);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      toast('Chưa chọn file', 'Vui lòng chọn file Word/PDF/Excel', 'warn');
      return;
    }
    setUploading(true);
    try {
      const jobId = await importApi.upload(file, subject);
      toast('Đang xử lý', 'AI đang phân tích file...', 'info');
      let completed = false;
      // Poll preview
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const p = await importApi.getPreview(jobId);
        if (p.status === 'REVIEW' || p.status === 'FAILED') {
          completed = true;
          setPreview(p);
          setSelected(new Set(p.questions.map((_, idx) => idx)));
          if (p.status === 'FAILED') {
            toast('Lỗi', p.errorMessage || 'AI xử lý thất bại', 'error');
          } else {
            toast('Hoàn tất', `Tìm thấy ${p.totalFound} câu hỏi`, 'success');
          }
          break;
        }
      }
      if (!completed) {
        const latest = await importApi.getPreview(jobId);
        if (latest.status === 'REVIEW' || latest.status === 'FAILED') {
          setPreview(latest);
          setSelected(new Set(latest.questions.map((_, idx) => idx)));
        } else {
          setPreview(latest);
          toast('Quá thời gian chờ', 'Tệp vẫn đang được xử lý. Hãy thử tải lại bản xem trước sau ít phút.', 'warn');
        }
      }
    } catch (err) {
      toast('Lỗi', extractError(err), 'error');
    } finally {
      setUploading(false);
    }
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
          Upload file Word/PDF/Excel → AI tự động tách câu hỏi & đáp án
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
              accept=".docx,.pdf,.xlsx,.xls"
              className="hidden"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Icon name="upload" size={28} />
            </div>
            <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">
              {file ? file.name : 'Kéo thả file vào đây hoặc bấm để chọn'}
            </div>
            <div className="text-xs text-slate-500">
              Hỗ trợ: .docx, .pdf, .xlsx, .xls — Tối đa 20MB
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
            {uploading ? 'AI đang xử lý...' : 'Bắt đầu import bằng AI'}
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
      {preview && preview.status === 'REVIEW' && (
        <>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                <Icon name="check" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Tìm thấy {preview.totalFound} câu hỏi
                </h3>
                <p className="text-xs text-slate-500">{preview.originalName}</p>
              </div>
            </div>
            <div className="flex gap-2">
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
                        {q.type}
                      </span>
                    </div>
                    <label className="block mb-3" onClick={(event) => event.stopPropagation()}>
                      <span className="sr-only">Nội dung câu hỏi {idx + 1}</span>
                      <textarea
                        value={q.content}
                        onChange={(event) => setPreview({
                          ...preview,
                          questions: preview.questions.map((question, questionIndex) =>
                            questionIndex === idx ? { ...question, content: event.target.value } : question),
                        })}
                        onClick={(event) => event.stopPropagation()}
                        className="w-full resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                      />
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
                                onChange={(event) => setPreview({
                                  ...preview,
                                  questions: preview.questions.map((question, questionIndex) =>
                                    questionIndex === idx
                                      ? { ...question, options: question.options.map((option, optionIndex) => optionIndex === i ? event.target.value : option) }
                                      : question),
                                })}
                                onClick={(event) => event.stopPropagation()}
                                className="w-[calc(100%-2rem)] bg-transparent outline-none"
                              />
                              {isCorrect && ' ✓'}
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {q.explanation && (
                      <div className="mt-3 text-xs p-3 rounded-lg bg-amber-50 text-amber-700">
                        💡 {q.explanation}
                      </div>
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
            onClick={async () => {
              try {
                const latest = await importApi.getPreview(preview.jobId);
                setPreview(latest);
                if (latest.status === 'REVIEW') setSelected(new Set(latest.questions.map((_, idx) => idx)));
              } catch (error) {
                toast('Không tải được bản xem trước', extractError(error), 'error');
              }
            }}
          >
            Tải lại trạng thái
          </Button>
        </div>
      )}
    </div>
  );
}