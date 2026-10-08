import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Input, Select, Textarea } from '../components/Input';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { examApi, Exam } from '../api/exam';
import { Difficulty, Question, QuestionFilter, questionApi } from '../api/question';
import { extractError } from '../api/client';
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS, SUBJECTS } from '../lib/utils';

interface ExamForm {
  title: string;
  description: string;
  subject: string;
  classroomId?: number;
  durationMin: number;
  totalPoints: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  proctorEnabled: boolean;
  lockScreen: boolean;
  maxAttempts: number;
  password: string;
  showAnswerAfter: string;
}

const initialForm: ExamForm = {
  title: '',
  description: '',
  subject: 'Toán',
  durationMin: 45,
  totalPoints: 10,
  shuffleQuestions: true,
  shuffleOptions: true,
  proctorEnabled: false,
  lockScreen: false,
  maxAttempts: 1,
  password: '',
  showAnswerAfter: 'AFTER_SUBMIT',
};

export default function ExamBuilder() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<ExamForm>({
    ...initialForm,
    classroomId: Number(searchParams.get('classroomId')) || undefined,
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [pickerFilter, setPickerFilter] = useState<QuestionFilter>({ page: 0, size: 10 });
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickedIds, setPickedIds] = useState<Set<number>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const examIdRef = useRef<number | null>(id ? Number(id) : null);
  const formRef = useRef(form);
  const questionsRef = useRef(questions);
  const savingRef = useRef(false);
  formRef.current = form;
  questionsRef.current = questions;

  useEffect(() => {
    if (!id) {
      const initialIds = searchParams.get('questionIds')
        ?.split(',')
        .map(Number)
        .filter((questionId) => Number.isInteger(questionId) && questionId > 0) || [];
      if (initialIds.length) {
        Promise.all(initialIds.map((questionId) => questionApi.get(questionId)))
          .then(setQuestions)
          .catch((err: unknown) => toast('Không tải được câu hỏi đã chọn', extractError(err), 'error'));
      }
      return;
    }
    setLoading(true);
    examApi.get(Number(id))
      .then((exam) => {
        examIdRef.current = Number(id);
        setForm({
          title: exam.title,
          description: exam.description || '',
          subject: exam.subject || 'Toán',
          classroomId: exam.classroomId,
          durationMin: exam.durationMin,
          totalPoints: exam.totalPoints || 10,
          shuffleQuestions: exam.shuffleQuestions,
          shuffleOptions: exam.shuffleOptions,
          proctorEnabled: exam.proctorEnabled,
          lockScreen: exam.lockScreen,
          maxAttempts: exam.maxAttempts,
          password: '',
          showAnswerAfter: exam.showAnswerAfter || 'AFTER_SUBMIT',
        });
        setQuestions(exam.questions || []);
      })
      .catch((err: unknown) => toast('Không tải được đề thi', extractError(err), 'error'))
      .finally(() => setLoading(false));
  }, [id, searchParams, toast]);

  const persistDraft = useCallback(async (notify: boolean) => {
    const current = formRef.current;
    if (!current.title.trim() || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    const payload: Exam = {
      ...current,
      title: current.title.trim(),
      status: 'DRAFT',
      questionIds: questionsRef.current.flatMap((question) => question.id ? [question.id] : []),
    };
    try {
      if (examIdRef.current) {
        await examApi.update(examIdRef.current, payload);
      } else {
        const created = await examApi.create(payload);
        if (!created.id) throw new Error('Máy chủ không trả về mã đề thi vừa tạo');
        examIdRef.current = created.id;
      }
      setSavedAt(new Date());
      if (notify) toast('Đã lưu bản nháp', current.title, 'success');
      return true;
    } catch (err) {
      toast('Không lưu được đề thi', extractError(err), 'error');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [toast]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void persistDraft(false);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [persistDraft]);

  const loadQuestions = useCallback(async () => {
    setPickerLoading(true);
    try {
      const result = await questionApi.list({ ...pickerFilter, subject: pickerFilter.subject || form.subject });
      setBankQuestions(result.content);
    } catch (err) {
      toast('Không tải được ngân hàng câu hỏi', extractError(err), 'error');
    } finally {
      setPickerLoading(false);
    }
  }, [pickerFilter, form.subject, toast]);

  useEffect(() => {
    if (pickerOpen) void loadQuestions();
  }, [pickerOpen, loadQuestions]);

  const toggleQuestion = (question: Question) => {
    if (!question.id) return;
    setPickedIds((current) => {
      const next = new Set(current);
      if (next.has(question.id!)) next.delete(question.id!);
      else next.add(question.id!);
      return next;
    });
  };

  const addPickedQuestions = () => {
    const additions = bankQuestions.filter((question) => question.id && pickedIds.has(question.id)
      && !questions.some((existing) => existing.id === question.id));
    setQuestions((current) => [...current, ...additions]);
    setPickedIds(new Set());
    setPickerOpen(false);
  };

  const moveQuestion = (index: number, offset: number) => {
    const destination = index + offset;
    if (destination < 0 || destination >= questions.length) return;
    setQuestions((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  };

  const dropQuestion = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    setQuestions((current) => {
      const next = [...current];
      const [item] = next.splice(dragIndex, 1);
      next.splice(index, 0, item);
      return next;
    });
    setDragIndex(null);
  };

  const removeQuestion = (index: number) => {
    setQuestions((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSave = async (publish: boolean) => {
    if (!form.title.trim()) {
      toast('Thiếu tiêu đề', 'Vui lòng nhập tiêu đề đề thi', 'warn');
      return;
    }
    if (!questions.length) {
      toast('Chưa có câu hỏi', 'Thêm ít nhất một câu hỏi trước khi lưu đề thi', 'warn');
      return;
    }
    const saved = await persistDraft(false);
    if (!saved) return;
    if (publish && examIdRef.current) {
      try {
        await examApi.publish(examIdRef.current);
        toast('Đã công khai đề thi', 'Học sinh đủ điều kiện có thể làm bài', 'success');
      } catch (err) {
        toast('Không công khai được đề thi', extractError(err), 'error');
        return;
      }
    } else {
      toast('Đã lưu bản nháp', form.title, 'success');
    }
    navigate('/exams');
  };

  if (loading) {
    return <div className="p-16 text-center"><div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const toggles: { key: keyof Pick<ExamForm, 'shuffleQuestions' | 'shuffleOptions' | 'proctorEnabled' | 'lockScreen'>; label: string; description: string }[] = [
    { key: 'shuffleQuestions', label: 'Trộn câu hỏi', description: 'Đảo thứ tự câu hỏi mỗi lượt thi' },
    { key: 'shuffleOptions', label: 'Trộn đáp án', description: 'Đảo thứ tự các phương án' },
    { key: 'proctorEnabled', label: 'Giám sát Pro', description: 'Theo dõi rời tab và toàn màn hình' },
    { key: 'lockScreen', label: 'Yêu cầu toàn màn hình', description: 'Nhắc học sinh bật toàn màn hình' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button aria-label="Quay lại" onClick={() => navigate('/exams')} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"><Icon name="chevronL" /></button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{id ? 'Sửa đề thi' : 'Tạo đề thi mới'}</h1>
            <p className="text-xs text-slate-500">{savedAt ? `Tự lưu lúc ${savedAt.toLocaleTimeString('vi-VN')}` : 'Bản nháp tự lưu mỗi 30 giây'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setPreviewOpen(true)} icon={<Icon name="eye" size={16} />}>Xem trước</Button>
          <Button variant="ghost" loading={saving} onClick={() => void handleSave(false)} icon={<Icon name="save" size={16} />}>Lưu nháp</Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSave(true)}>Công khai</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)] gap-6 items-start">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="font-bold text-slate-900 dark:text-white">Thông tin đề thi</h2>
            <Input label="Tiêu đề *" required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ví dụ: Kiểm tra giữa kỳ Toán 12" />
            <Textarea label="Mô tả" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Select label="Môn học" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} options={SUBJECTS.map((subject) => ({ value: subject, label: subject }))} />
              <Input label="Thời gian (phút)" type="number" min={1} max={600} value={form.durationMin} onChange={(event) => setForm({ ...form, durationMin: Number(event.target.value) })} />
              <Input label="Thang điểm" type="number" min={1} max={100} step={0.5} value={form.totalPoints} onChange={(event) => setForm({ ...form, totalPoints: Number(event.target.value) })} />
              <Input label="Số lần làm tối đa" type="number" min={1} max={20} value={form.maxAttempts} onChange={(event) => setForm({ ...form, maxAttempts: Number(event.target.value) })} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Câu hỏi ({questions.length})</h2>
                <p className="text-xs text-slate-500 mt-1">Kéo thả hoặc dùng mũi tên để đổi thứ tự</p>
              </div>
              <Button variant="primary" size="sm" icon={<Icon name="plus" size={15} />} onClick={() => setPickerOpen(true)}>Chọn câu hỏi</Button>
            </div>
            {questions.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-500">Chưa có câu hỏi. Chọn từ ngân hàng để thêm vào đề.</div>
            ) : (
              <div className="space-y-3">
                {questions.map((question, index) => (
                  <div key={question.id ?? `${question.content}-${index}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropQuestion(index)} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 cursor-move">
                    <div className="flex items-start gap-3">
                      <span className="pt-1 text-xs font-bold text-slate-400">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{question.content}</p>
                        <p className="text-xs text-slate-500 mt-2">{QUESTION_TYPE_LABELS[question.type]} · {DIFFICULTY_LABELS[question.difficulty]}</p>
                      </div>
                      <div className="flex flex-col">
                        <button aria-label="Di chuyển lên" disabled={index === 0} onClick={() => moveQuestion(index, -1)} className="p-1 text-slate-400 disabled:opacity-30">↑</button>
                        <button aria-label="Di chuyển xuống" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)} className="p-1 text-slate-400 disabled:opacity-30">↓</button>
                        <button aria-label="Xóa câu khỏi đề" onClick={() => removeQuestion(index)} className="p-1 text-red-400"><Icon name="trash" size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h2 className="font-bold text-slate-900 dark:text-white mb-4">Cấu hình nâng cao</h2>
            <div className="space-y-4">
              {toggles.map(({ key, label, description }) => (
                <label key={key} className="flex items-start justify-between gap-3 cursor-pointer">
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{description}</span>
                  </span>
                  <input type="checkbox" checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} className="mt-1 h-4 w-4 accent-blue-600" />
                </label>
              ))}
            </div>
            <div className="mt-5 space-y-4">
              <Input label="Mật khẩu đề thi (tùy chọn)" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} helper={id ? 'Để trống để giữ mật khẩu hiện tại' : undefined} />
              <Select label="Hiển thị đáp án" value={form.showAnswerAfter} onChange={(event) => setForm({ ...form, showAnswerAfter: event.target.value })} options={[
                { value: 'AFTER_SUBMIT', label: 'Sau khi nộp bài' },
                { value: 'AFTER_CLOSE', label: 'Sau khi đóng đề' },
                { value: 'NEVER', label: 'Không hiển thị' },
              ]} />
            </div>
          </section>

          <section className="rounded-2xl border border-blue-100 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-5">
            <h3 className="font-bold text-slate-900 dark:text-white">Xem trước</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{form.title || 'Tên đề thi'} · {form.durationMin} phút · {questions.length} câu</p>
            <div className="mt-4 rounded-xl bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500">Thang điểm</div>
              <div className="text-xl font-extrabold text-blue-600">{form.totalPoints}</div>
            </div>
          </section>
        </aside>
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Chọn câu hỏi từ ngân hàng" size="lg">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <Input placeholder="Tìm câu hỏi" value={pickerFilter.keyword || ''} onChange={(event) => setPickerFilter({ ...pickerFilter, keyword: event.target.value || undefined, page: 0 })} />
            <Select aria-label="Lọc độ khó" value={pickerFilter.difficulty || ''} onChange={(event) => setPickerFilter({ ...pickerFilter, difficulty: (event.target.value || undefined) as Difficulty | undefined, page: 0 })} options={[{ value: '', label: 'Mọi độ khó' }, ...Object.entries(DIFFICULTY_LABELS).map(([value, label]) => ({ value, label }))]} />
            <Select aria-label="Lọc môn học" value={pickerFilter.subject || form.subject} onChange={(event) => setPickerFilter({ ...pickerFilter, subject: event.target.value || undefined, page: 0 })} options={[{ value: '', label: 'Mọi môn' }, ...SUBJECTS.map((subject) => ({ value: subject, label: subject }))]} />
          </div>
          {pickerLoading ? <div className="p-8 text-center"><div className="inline-block w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div> : bankQuestions.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Không tìm thấy câu hỏi phù hợp.</p> : (
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {bankQuestions.map((question) => (
                <label key={question.id} className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
                  <input type="checkbox" checked={question.id ? pickedIds.has(question.id) : false} onChange={() => toggleQuestion(question)} className="mt-1 accent-blue-600" />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{question.content}</span>
                    <span className="block mt-1 text-xs text-slate-500">{question.subject} · {QUESTION_TYPE_LABELS[question.type]}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>Hủy</Button>
            <Button variant="primary" onClick={addPickedQuestions}>Thêm {pickedIds.size} câu</Button>
          </div>
        </div>
      </Modal>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Xem trước đề thi" size="lg">
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{form.title || 'Tên đề thi'}</h2>
            <p className="text-sm text-slate-500">{form.subject} · {form.durationMin} phút · {questions.length} câu</p>
          </div>
          {questions.map((question, index) => (
            <div key={question.id ?? index} className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <p className="font-semibold text-sm text-slate-900 dark:text-white">Câu {index + 1}. {question.content}</p>
              {question.options?.map((option, optionIndex) => <p key={optionIndex} className="mt-2 pl-3 text-sm text-slate-600 dark:text-slate-400">{String.fromCharCode(65 + optionIndex)}. {option}</p>)}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
