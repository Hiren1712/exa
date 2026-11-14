import { useState } from 'react';
import { Link } from 'react-router-dom';
import { aiApi, EssayGradeSuggestion } from '../api/ai';
import { extractError } from '../api/client';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { MathText } from '../components/MathText';
import { SubjectInput } from '../components/SubjectInput';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { DIFFICULTY_LABELS } from '../lib/utils';
import { useLanguage } from '../i18n';

export default function AIStudio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
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
    if (!subject.trim()) {
      toast(t('Thiếu môn học'), t('Hãy nhập môn học cần tạo câu hỏi.'), 'warn');
      return;
    }
    if (!topic.trim()) {
      toast(t('Thiếu chủ đề'), t('Hãy nhập chủ đề cần tạo câu hỏi.'), 'warn');
      return;
    }
    setGenerating(true);
    try {
      const result = await aiApi.generateQuestions({ subject: subject.trim(), grade, topic: topic.trim(), count, difficulty });
      setQuestions(result);
      toast(t('Đã lưu câu hỏi'), t('{{count}} câu đã được thêm vào ngân hàng câu hỏi.', { count: result.length }), 'success');
    } catch (error) {
      toast(t('Không tạo được câu hỏi'), extractError(error), 'error');
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
      toast(t('Không chấm được câu trả lời'), extractError(error), 'error');
    } finally {
      setGrading(false);
    }
  };

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border border-indigo-200 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-white"><Icon name="sparkle" size={25} /></div>
        <h1 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">{t('AI Studio yêu cầu gói Pro')}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('Tài khoản hiện tại đang dùng gói {{plan}}. Việc đổi gói cần được xác nhận qua quản trị viên; trang này không tự mở khóa gói trả phí.', { plan: user?.plan || 'FREE' })}</p>
        <Link to="/settings" className="mt-5 inline-block text-sm font-semibold text-blue-600">{t('Mở cài đặt tài khoản')}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="exa-card p-5 sm:p-6">
        <div className="text-xs font-bold tracking-widest uppercase text-blue-700 dark:text-blue-300">{t('Trợ lý giảng dạy')}</div>
        <h1 className="exa-page-title mt-1 text-slate-900 dark:text-white">AI Studio</h1>
        <p className="exa-page-subtitle mt-1">{t('Tạo câu hỏi từ chủ đề và nhận gợi ý chấm tự luận có kiểm soát. Hãy kiểm tra kết quả AI trước khi sử dụng.')}</p>
      </header>
      <div role="tablist" aria-label={t('Công cụ AI')} className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1.5">
        <button type="button" role="tab" aria-selected={tool === 'generate'} onClick={() => setTool('generate')} className={`flex-1 min-w-36 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${tool === 'generate' ? 'bg-white dark:bg-slate-700 shadow text-blue-800 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/50'}`}>{t('Sinh câu hỏi')}</button>
        <button type="button" role="tab" aria-selected={tool === 'grade'} onClick={() => setTool('grade')} className={`flex-1 min-w-36 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${tool === 'grade' ? 'bg-white dark:bg-slate-700 shadow text-blue-800 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/50'}`}>{t('Gợi ý chấm tự luận')}</button>
      </div>

      {tool === 'generate' ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <SubjectInput value={subject} onChange={setSubject} required />
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('Khối lớp')}
              <select value={grade} onChange={(event) => setGrade(Number(event.target.value))} className="exa-field mt-2 w-full px-3 py-2.5 text-sm">{[6, 7, 8, 9, 10, 11, 12].map((item) => <option key={item} value={item}>{t('Khối {{grade}}', { grade: item })}</option>)}</select>
            </label>
            <label className="text-xs font-semibold text-slate-500 sm:col-span-2">{t('Chủ đề')}
              <input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={200} placeholder={t('VD: Phương trình bậc hai')} className="exa-field mt-2 w-full px-3 py-2.5 text-sm" />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('Số câu')}
              <input type="number" min={1} max={20} value={count} onChange={(event) => setCount(Number(event.target.value))} className="exa-field mt-2 w-full px-3 py-2.5 text-sm" />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('Độ khó')}
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="exa-field mt-2 w-full px-3 py-2.5 text-sm">{Object.entries(DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>
            </label>
          </div>
          <Button variant="primary" loading={generating} onClick={() => void generate()} icon={<Icon name="sparkle" size={16} />}>Tạo và lưu câu hỏi</Button>
          {questions.length > 0 && <div className="space-y-3">{questions.map((question, index) => <article key={question.id ?? index} className="rounded-xl border border-slate-100 dark:border-slate-800 p-4"><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{index + 1}. <MathText>{question.content}</MathText></h2>{question.correctAnswer && <p className="mt-2 text-xs text-emerald-700">Đáp án: {question.correctAnswer}</p>}{question.explanation && <p className="mt-1 text-xs text-slate-500"><MathText>{question.explanation}</MathText></p>}</article>)}</div>}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{t('Câu hỏi')}<input value={essayQuestion} onChange={(event) => setEssayQuestion(event.target.value)} maxLength={5000} className="exa-field mt-2 w-full px-3 py-2.5 text-sm" /></label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{t('Bài làm')}<textarea value={essayAnswer} onChange={(event) => setEssayAnswer(event.target.value)} maxLength={12000} rows={6} className="exa-field mt-2 w-full px-3 py-2.5 text-sm" /></label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{t('Tiêu chí chấm')}<textarea value={rubric} onChange={(event) => setRubric(event.target.value)} maxLength={5000} rows={3} placeholder={t('Không bắt buộc')} className="exa-field mt-2 w-full px-3 py-2.5 text-sm" /></label>
          <label className="block max-w-xs text-sm font-semibold text-slate-700 dark:text-slate-200">{t('Điểm tối đa')}<input type="number" min={0.01} max={10} step={0.25} value={maxScore} onChange={(event) => setMaxScore(Number(event.target.value))} className="exa-field mt-2 w-full px-3 py-2.5 text-sm" /></label>
          <Button variant="primary" loading={grading} onClick={() => void suggestGrade()} icon={<Icon name="sparkle" size={16} />}>{t('Nhận gợi ý từ AI')}</Button>
          {suggestion && <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-4"><p className="font-bold text-blue-800 dark:text-blue-200">{t('Điểm gợi ý: {{score}} / {{max}}', { score: suggestion.score, max: maxScore })}</p><p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{suggestion.feedback}</p><p className="mt-2 text-xs text-slate-500">{t('Gợi ý này chưa được lưu vào bài nộp; giáo viên cần tự xác nhận điểm.')}</p></div>}
        </section>
      )}
    </div>
  );
}
