import { useState } from 'react';
import { Link } from 'react-router-dom';
import { aiApi, EssayGradeSuggestion } from '../api/ai';
import { extractError } from '../api/client';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { SUBJECTS, DIFFICULTY_LABELS } from '../lib/utils';

export default function AIStudio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tool, setTool] = useState<'generate' | 'grade'>('generate');
  const [generating, setGenerating] = useState(false);
  const [grading, setGrading] = useState(false);
  const [questions, setQuestions] = useState<Array<{ id?: number; content: string; correctAnswer?: string; explanation?: string }>>([]);
  const [suggestion, setSuggestion] = useState<EssayGradeSuggestion | null>(null);
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState(12);
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('COMPREHENSION');
  const [essayQuestion, setEssayQuestion] = useState('');
  const [essayAnswer, setEssayAnswer] = useState('');
  const [rubric, setRubric] = useState('');
  const [maxScore, setMaxScore] = useState(10);

  const isPro = user?.plan === 'PRO' || user?.plan === 'ENTERPRISE';

  const generate = async () => {
    if (!topic.trim()) {
      toast('Thiếu chủ đề', 'Hãy nhập chủ đề cần tạo câu hỏi.', 'warn');
      return;
    }
    setGenerating(true);
    try {
      const result = await aiApi.generateQuestions({ subject, grade, topic: topic.trim(), count, difficulty });
      setQuestions(result);
      toast('Đã lưu câu hỏi', `${result.length} câu đã được thêm vào ngân hàng câu hỏi.`, 'success');
    } catch (error) {
      toast('Không tạo được câu hỏi', extractError(error), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const suggestGrade = async () => {
    setGrading(true);
    setSuggestion(null);
    try {
      const result = await aiApi.gradeEssay({
        question: essayQuestion,
        answer: essayAnswer,
        rubric,
        maxScore,
      });
      setSuggestion(result);
    } catch (error) {
      toast('Không chấm được câu trả lời', extractError(error), 'error');
    } finally {
      setGrading(false);
    }
  };

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border border-indigo-200 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-white"><Icon name="sparkle" size={25} /></div>
        <h1 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">AI Studio yêu cầu gói Pro</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Tài khoản hiện tại đang dùng gói {user?.plan || 'FREE'}. Việc đổi gói cần được xác nhận qua quản trị viên; trang này không tự mở khóa gói trả phí.</p>
        <Link to="/settings" className="mt-5 inline-block text-sm font-semibold text-blue-600">Mở cài đặt tài khoản</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">AI Studio</h1>
        <p className="mt-1 text-sm text-slate-500">Câu hỏi do AI tạo sẽ được lưu vào ngân hàng; điểm tự luận là gợi ý để giáo viên xem xét.</p>
      </header>
      <div className="flex gap-2 rounded-2xl bg-slate-100 dark:bg-slate-900 p-1">
        <button onClick={() => setTool('generate')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold ${tool === 'generate' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-slate-500'}`}>Sinh câu hỏi</button>
        <button onClick={() => setTool('grade')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold ${tool === 'grade' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-slate-500'}`}>Gợi ý chấm tự luận</button>
      </div>

      {tool === 'generate' ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-slate-500">Môn học
              <select value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm">{SUBJECTS.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <label className="text-xs font-semibold text-slate-500">Khối lớp
              <select value={grade} onChange={(event) => setGrade(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm">{[6, 7, 8, 9, 10, 11, 12].map((item) => <option key={item} value={item}>Khối {item}</option>)}</select>
            </label>
            <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Chủ đề
              <input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={200} placeholder="VD: Phương trình bậc hai" className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-500">Số câu
              <input type="number" min={1} max={20} value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-500">Độ khó
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm">{Object.entries(DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>
          </div>
          <Button variant="primary" loading={generating} onClick={() => void generate()} icon={<Icon name="sparkle" size={16} />}>Tạo và lưu câu hỏi</Button>
          {questions.length > 0 && <div className="space-y-3">{questions.map((question, index) => <article key={question.id ?? index} className="rounded-xl border border-slate-100 dark:border-slate-800 p-4"><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{index + 1}. {question.content}</h2>{question.correctAnswer && <p className="mt-2 text-xs text-emerald-700">Đáp án: {question.correctAnswer}</p>}{question.explanation && <p className="mt-1 text-xs text-slate-500">{question.explanation}</p>}</article>)}</div>}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <label className="block text-xs font-semibold text-slate-500">Câu hỏi<input value={essayQuestion} onChange={(event) => setEssayQuestion(event.target.value)} maxLength={5000} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" /></label>
          <label className="block text-xs font-semibold text-slate-500">Bài làm<textarea value={essayAnswer} onChange={(event) => setEssayAnswer(event.target.value)} maxLength={12000} rows={6} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" /></label>
          <label className="block text-xs font-semibold text-slate-500">Tiêu chí chấm<textarea value={rubric} onChange={(event) => setRubric(event.target.value)} maxLength={5000} rows={3} placeholder="Không bắt buộc" className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" /></label>
          <label className="block max-w-xs text-xs font-semibold text-slate-500">Điểm tối đa<input type="number" min={0.01} max={10} step={0.25} value={maxScore} onChange={(event) => setMaxScore(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" /></label>
          <Button variant="primary" loading={grading} onClick={() => void suggestGrade()} icon={<Icon name="sparkle" size={16} />}>Nhận gợi ý từ AI</Button>
          {suggestion && <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-4"><p className="font-bold text-blue-700">Điểm gợi ý: {suggestion.score} / {maxScore}</p><p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{suggestion.feedback}</p><p className="mt-2 text-xs text-slate-500">Gợi ý này chưa được lưu vào bài nộp; giáo viên cần tự xác nhận điểm.</p></div>}
        </section>
      )}
    </div>
  );
}
