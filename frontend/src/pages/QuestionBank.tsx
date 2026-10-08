import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Input, Select, Textarea } from '../components/Input';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { extractError } from '../api/client';
import { Difficulty, Question, QuestionFilter, QuestionType, questionApi } from '../api/question';
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS, SUBJECTS } from '../lib/utils';

const emptyQuestion: Question = {
  subject: 'Toán',
  grade: 12,
  unit: '',
  difficulty: 'RECOGNITION',
  type: 'MCQ',
  content: '',
  options: ['', '', '', ''],
  correctAnswer: 'A',
  answerText: '',
  explanation: '',
};

const difficultyOptions = Object.entries(DIFFICULTY_LABELS).map(([value, label]) => ({ value, label }));
const typeOptions = Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function QuestionBank() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<QuestionFilter>({ page: 0, size: 20 });
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [form, setForm] = useState<Question>(emptyQuestion);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await questionApi.list(filter);
      setQuestions(result.content || []);
      setTotal(result.totalElements || 0);
      setSelected(new Set());
    } catch (err) {
      toast('Không tải được câu hỏi', extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const beginCreate = () => {
    setEditing(null);
    setForm({ ...emptyQuestion, options: [...(emptyQuestion.options || [])] });
    setModalOpen(true);
  };

  const beginEdit = (question: Question) => {
    setEditing(question);
    setForm({
      ...emptyQuestion,
      ...question,
      options: question.options?.length ? [...question.options] : ['', '', '', ''],
    });
    setModalOpen(true);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.content.trim()) {
      toast('Thiếu nội dung', 'Vui lòng nhập nội dung câu hỏi', 'warn');
      return;
    }
    const options = form.type === 'MCQ'
      ? (form.options || []).map((option) => option.trim()).filter(Boolean)
      : undefined;
    if (form.type === 'MCQ' && (options?.length ?? 0) < 2) {
      toast('Thiếu phương án', 'Câu trắc nghiệm cần ít nhất hai phương án', 'warn');
      return;
    }
    setSaving(true);
    try {
      const payload: Question = {
        ...form,
        options,
        correctAnswer: form.type === 'MCQ' || form.type === 'TRUE_FALSE' ? form.correctAnswer : undefined,
      };
      if (editing?.id) {
        await questionApi.update(editing.id, payload);
        toast('Đã cập nhật câu hỏi', '', 'success');
      } else {
        await questionApi.create(payload);
        toast('Đã tạo câu hỏi', '', 'success');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast('Không lưu được câu hỏi', extractError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (question: Question) => {
    if (!question.id || !confirm('Bạn có chắc muốn xóa câu hỏi này?')) return;
    try {
      await questionApi.delete(question.id);
      toast('Đã xóa câu hỏi', '', 'success');
      await load();
    } catch (err) {
      toast('Không xóa được câu hỏi', extractError(err), 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0 || !confirm(`Xóa ${selected.size} câu hỏi đã chọn?`)) return;
    try {
      const count = await questionApi.bulkDelete([...selected]);
      toast('Đã xóa câu hỏi', `${count} câu`, 'success');
      await load();
    } catch (err) {
      toast('Không xóa được các câu đã chọn', extractError(err), 'error');
    }
  };

  const handleAddToExam = () => {
    const ids = questions.filter((question) => question.id && selected.has(question.id)).map((question) => question.id);
    if (!ids.length) return;
    navigate(`/exams/new?questionIds=${ids.join(',')}`);
  };

  const toggleSelected = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateFilter = (patch: Partial<QuestionFilter>) => {
    setFilter((current) => ({ ...current, ...patch, page: 0 }));
  };

  const setOption = (index: number, value: string) => {
    setForm((current) => ({
      ...current,
      options: (current.options || []).map((option, optionIndex) => optionIndex === index ? value : option),
    }));
  };

  const updateType = (type: QuestionType) => {
    setForm((current) => ({
      ...current,
      type,
      options: type === 'MCQ' ? ['', '', '', ''] : undefined,
      correctAnswer: type === 'TRUE_FALSE' ? 'Đúng' : '',
    }));
  };

  const page = filter.page || 0;
  const pageCount = Math.max(1, Math.ceil(total / (filter.size || 20)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Ngân hàng câu hỏi</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} câu hỏi trong kho</p>
        </div>
        <div className="flex gap-2">
          <Link to="/import"><Button variant="ghost" icon={<Icon name="upload" size={16} />}>Import Word/PDF</Button></Link>
          <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={beginCreate}>Tạo câu hỏi</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <Input
          placeholder="Tìm nội dung câu hỏi..."
          value={filter.keyword || ''}
          onChange={(event) => updateFilter({ keyword: event.target.value || undefined })}
          icon={<Icon name="search" size={16} />}
        />
        <Select
          aria-label="Môn học"
          value={filter.subject || ''}
          onChange={(event) => updateFilter({ subject: event.target.value || undefined })}
          options={[{ value: '', label: 'Tất cả môn' }, ...SUBJECTS.map((subject) => ({ value: subject, label: subject }))]}
        />
        <Select
          aria-label="Khối lớp"
          value={filter.grade || ''}
          onChange={(event) => updateFilter({ grade: event.target.value ? Number(event.target.value) : undefined })}
          options={[{ value: '', label: 'Tất cả khối' }, ...[6, 7, 8, 9, 10, 11, 12].map((grade) => ({ value: grade, label: `Khối ${grade}` }))]}
        />
        <Select
          aria-label="Độ khó"
          value={filter.difficulty || ''}
          onChange={(event) => updateFilter({ difficulty: (event.target.value || undefined) as Difficulty | undefined })}
          options={[{ value: '', label: 'Tất cả độ khó' }, ...difficultyOptions]}
        />
        <Select
          aria-label="Loại câu hỏi"
          value={filter.type || ''}
          onChange={(event) => updateFilter({ type: (event.target.value || undefined) as QuestionType | undefined })}
          options={[{ value: '', label: 'Tất cả loại' }, ...typeOptions]}
        />
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-sm">
          <span className="font-semibold text-blue-700 dark:text-blue-300">Đã chọn {selected.size} câu</span>
          <Button size="sm" variant="primary" onClick={handleAddToExam}>Thêm vào đề thi</Button>
          <Button size="sm" variant="danger" onClick={() => void handleBulkDelete()}>Xóa đã chọn</Button>
          <button className="text-xs text-slate-500" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center"><div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-16 text-center">
          <Icon name="layers" size={28} className="mx-auto mb-3 text-blue-500" />
          <h2 className="font-bold text-slate-700 dark:text-slate-300">Chưa tìm thấy câu hỏi</h2>
          <p className="text-sm text-slate-500 mt-1">Tạo câu hỏi mới hoặc thay đổi bộ lọc.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((question) => (
            <article key={question.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-start gap-3">
                {question.id && <input aria-label={`Chọn câu ${question.id}`} type="checkbox" checked={selected.has(question.id)} onChange={() => toggleSelected(question.id!)} className="mt-1 accent-blue-600" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-xs font-semibold text-blue-600">{question.subject}{question.grade ? ` · Khối ${question.grade}` : ''}</span>
                    <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-600">{DIFFICULTY_LABELS[question.difficulty]}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{QUESTION_TYPE_LABELS[question.type]}</span>
                    {question.unit && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{question.unit}</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-900 dark:text-white">{question.content}</p>
                  {question.options && (
                    <div className="mt-3 grid sm:grid-cols-2 gap-2">
                      {question.options.map((option, index) => {
                        const answerLabel = String.fromCharCode(65 + index);
                        const correct = question.correctAnswer === answerLabel;
                        return <div key={`${question.id}-${index}`} className={`rounded-lg px-3 py-2 text-xs ${correct ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{answerLabel}. {option}</div>;
                      })}
                    </div>
                  )}
                  {question.explanation && <p className="mt-3 text-xs text-slate-500"><strong>Lời giải:</strong> {question.explanation}</p>}
                </div>
                <div className="flex gap-1">
                  <button aria-label="Sửa câu hỏi" onClick={() => beginEdit(question)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Icon name="edit" size={16} /></button>
                  <button aria-label="Xóa câu hỏi" onClick={() => void handleDelete(question)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Icon name="trash" size={16} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && total > (filter.size || 20) && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Trang {page + 1} / {pageCount}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setFilter({ ...filter, page: page - 1 })}>Trước</Button>
            <Button size="sm" variant="ghost" disabled={page + 1 >= pageCount} onClick={() => setFilter({ ...filter, page: page + 1 })}>Tiếp</Button>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Sửa câu hỏi' : 'Tạo câu hỏi'} size="lg">
        <form id="question-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Môn học" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} options={SUBJECTS.map((subject) => ({ value: subject, label: subject }))} />
            <Select label="Khối" value={form.grade || 12} onChange={(event) => setForm({ ...form, grade: Number(event.target.value) })} options={[6, 7, 8, 9, 10, 11, 12].map((grade) => ({ value: grade, label: `Khối ${grade}` }))} />
            <Input label="Đơn vị kiến thức" value={form.unit || ''} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="Ví dụ: Hàm số" />
            <Select label="Độ khó" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value as Difficulty })} options={difficultyOptions} />
          </div>
          <Select label="Loại câu hỏi" value={form.type} onChange={(event) => updateType(event.target.value as QuestionType)} options={typeOptions} />
          <Textarea label="Nội dung (có thể nhập ký hiệu LaTeX dạng văn bản)" required rows={5} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
          {form.type === 'MCQ' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Phương án trả lời</p>
              {(form.options || []).map((option, index) => (
                <Input key={index} label={`Phương án ${String.fromCharCode(65 + index)}`} value={option} onChange={(event) => setOption(index, event.target.value)} />
              ))}
              <Select label="Đáp án đúng" value={form.correctAnswer || 'A'} onChange={(event) => setForm({ ...form, correctAnswer: event.target.value })} options={(form.options || []).map((_, index) => ({ value: String.fromCharCode(65 + index), label: `Phương án ${String.fromCharCode(65 + index)}` }))} />
            </div>
          )}
          {form.type === 'TRUE_FALSE' && <Select label="Đáp án đúng" value={form.correctAnswer || 'Đúng'} onChange={(event) => setForm({ ...form, correctAnswer: event.target.value })} options={[{ value: 'Đúng', label: 'Đúng' }, { value: 'Sai', label: 'Sai' }]} />}
          {(form.type === 'SHORT_ANSWER' || form.type === 'ESSAY') && <Textarea label="Đáp án / hướng dẫn chấm" value={form.answerText || ''} onChange={(event) => setForm({ ...form, answerText: event.target.value })} />}
          <Textarea label="Lời giải chi tiết" value={form.explanation || ''} onChange={(event) => setForm({ ...form, explanation: event.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button type="submit" form="question-form" variant="primary" loading={saving}>{editing ? 'Lưu thay đổi' : 'Tạo câu hỏi'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
