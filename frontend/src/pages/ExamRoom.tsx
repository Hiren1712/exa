import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { MathText } from '../components/MathText';
import { QuestionImage } from '../components/QuestionImage';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { useExamTimer } from '../hooks/useExamTimer';
import { useProctor } from '../hooks/useProctor';
import { examApi, Exam } from '../api/exam';
import { submissionApi } from '../api/submission';
import { extractError } from '../api/client';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../i18n';

function shuffledIndexes(length: number): number[] {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[target]] = [indexes[target], indexes[index]];
  }
  return indexes;
}

export default function ExamRoom() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isPreview = searchParams.get('preview') === '1'
    && (user?.role === 'TEACHER' || user?.role === 'ADMIN');

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [optionOrder, setOptionOrder] = useState<Record<number, number[]>>({});
  const [examPassword, setExamPassword] = useState('');
  const answersRef = useRef(answers);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaveErrorShown, setAutoSaveErrorShown] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ score: number; needsManualGrading: number } | null>(null);
  answersRef.current = answers;

  const timer = useExamTimer({
    durationMin: exam?.durationMin || 45,
    autoStart: false,
    onExpire: () => {
      toast(t('Hết giờ'), t(isPreview ? 'Đã kết thúc lượt thử đề' : 'Bài đã được nộp tự động'), 'warn');
      handleSubmit(true);
    },
  });
  const resetTimer = timer.reset;

  const proctor = useProctor({
    enabled: !isPreview && submissionId !== null && submissionId > 0 && (exam?.proctorEnabled ?? false),
    sessionId: submissionId,
    onViolation: (type, total) => {
      toast(t('Cảnh báo'), t('{{event}} lần {{count}}', {
        event: t(type === 'TAB_SWITCH' ? 'Rời tab' : type === 'COPY' ? 'Copy' : 'Thoát fullscreen'),
        count: total,
      }), 'warn');
      if (submissionId && !isPreview) {
        void submissionApi.logProctorEvent(submissionId, type)
          .catch((err: unknown) => toast(t('Không ghi được nhật ký giám sát'), extractError(err), 'error'));
      }
    },
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const inviteCode = searchParams.get('invite') ?? undefined;
    examApi.get(Number(id), inviteCode)
      .then((data) => {
        const sourceQuestions = data.questions || [];
        const questionOrder = data.shuffleQuestions
          ? shuffledIndexes(sourceQuestions.length)
          : sourceQuestions.map((_, index) => index);
        const displayQuestions = questionOrder.map((questionIndex) => sourceQuestions[questionIndex]);
        const orderByQuestion: Record<number, number[]> = {};
        const shuffledQuestions = displayQuestions.map((question, index) => {
          const questionId = question.id ?? index + 1;
          const originalOptions = Array.isArray(question.options) ? question.options : [];
          const indexes = data.shuffleOptions
            ? shuffledIndexes(originalOptions.length)
            : originalOptions.map((_, optionIndex) => optionIndex);
          orderByQuestion[questionId] = indexes;
          return {
            ...question,
            options: indexes.map((optionIndex) => originalOptions[optionIndex].replace(/^[A-D][.)]\s*/i, '')),
            optionImages: indexes.map((optionIndex) => question.optionImages?.[optionIndex] || ''),
          };
        });
        setOptionOrder(orderByQuestion);
        setExam({ ...data, questions: shuffledQuestions });
        resetTimer(data.durationMin * 60);
      })
      .catch((err) => {
        toast(t('Lỗi'), extractError(err), 'error');
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, [id, navigate, resetTimer, searchParams, t, toast]);

  const handleStart = async () => {
    if (!exam || !id) return;
    setStarting(true);
    try {
      if (isPreview) {
        setAnswers({});
        setPreviewResult(null);
        setSubmissionId(-1);
        timer.reset(exam.durationMin * 60);
        timer.start();
        return;
      }
      if (exam.lockScreen || exam.proctorEnabled) {
        try {
          await proctor.requestFullscreen();
        } catch {
          if (exam.lockScreen) {
            toast(t('Cần bật toàn màn hình'), t('Trình duyệt không cho phép vào bài thi khi chưa bật toàn màn hình.'), 'error');
            return;
          }
          toast(t('Không bật được toàn màn hình'), t('Bạn vẫn có thể tiếp tục, nhưng sự kiện này có thể được ghi nhận.'), 'warn');
        }
      }
      const submission = await submissionApi.start(
        Number(id),
        examPassword || undefined,
        searchParams.get('invite') ?? undefined,
      );
      if (!submission.id) throw new Error('Máy chủ không trả về mã bài thi');
      const savedAnswers = typeof submission.answers === 'string'
        ? JSON.parse(submission.answers) as Record<string, string>
        : Array.isArray(submission.answers)
          ? Object.fromEntries(submission.answers.map((answer) => [String(answer.questionId), answer.answerData]))
          : {};
      setAnswers(Object.fromEntries(
        Object.entries(savedAnswers).map(([questionId, answer]) => [Number(questionId), answer]),
      ));
      setSubmissionId(submission.id);
      const startedAt = submission.startedAt ? new Date(submission.startedAt).getTime() : Date.now();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      timer.reset(Math.max(0, exam.durationMin * 60 - elapsedSeconds));
      timer.start();
    } catch (error) {
      await proctor.exitFullscreen();
      toast(t('Không vào được bài thi'), extractError(error), 'error');
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!submissionId || submissionId < 0 || !exam) return;
    const interval = window.setInterval(() => {
      const currentAnswers: Record<number, string> = {};
      exam.questions?.forEach((question, index) => {
        const questionId = question.id ?? index + 1;
        currentAnswers[questionId] = answersRef.current[questionId] ?? '';
      });
      void submissionApi.saveAnswers(submissionId, currentAnswers)
        .then(() => setAutoSaveErrorShown(false))
        .catch((err: unknown) => {
          if (!autoSaveErrorShown) {
            toast(t('Chưa lưu được đáp án tự động'), extractError(err), 'error');
            setAutoSaveErrorShown(true);
          }
        });
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [submissionId, exam, autoSaveErrorShown, t, toast]);

  const handleAnswer = (qIdx: number, answer: string) => {
    const questionId = exam?.questions?.[qIdx]?.id ?? qIdx + 1;
    setAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: answer }));
  };

  const handleSubmit = async (auto = false) => {
    if (!submissionId || !exam) return;
    if (!auto && !isPreview && !confirm('Bạn chắc chắn muốn nộp bài?')) return;

    setSubmitting(true);
    try {
      if (isPreview) {
        const questions = exam.questions || [];
        let score = 0;
        let needsManualGrading = 0;
        for (const question of questions) {
          const answer = answers[question.id ?? 0]?.trim() ?? '';
          if (question.type === 'ESSAY') {
            needsManualGrading += 1;
          } else if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
            if (answer && question.correctAnswer?.trim().toLowerCase() === answer.toLowerCase()) {
              score += question.points ?? 0;
            }
          } else if (question.type === 'SHORT_ANSWER' && answer) {
            const normalize = (value: string) => value.toLowerCase()
              .replace(/\s+/g, ' ')
              .replace(/[.,;:!?]/g, '')
              .trim();
            if (question.answerText && normalize(question.answerText) === normalize(answer)) {
              score += question.points ?? 0;
            }
          }
        }
        setPreviewResult({ score: Number(score.toFixed(2)), needsManualGrading });
        timer.pause();
        toast(t('Đã kết thúc lượt thử'), t('Lượt thử không được lưu vào kết quả hoặc số lần làm bài.'), 'success');
        return;
      }
      const result = await submissionApi.submit(submissionId, answers);
      toast(t('Nộp bài thành công'), t('Điểm: {{score}}/{{total}}', { score: result.totalScore ?? 0, total: exam.totalPoints || 10 }), 'success');
      proctor.exitFullscreen();
      navigate(`/exam/${id}/result?submissionId=${submissionId}`);
    } catch (err) {
      toast(t('Lỗi'), extractError(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !exam) {
    return (
      <div className="p-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!submissionId) {
    return (
      <div className="min-h-[70vh] grid place-items-center">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40"><Icon name="file" size={25} /></div>
          <h1 className="mt-4 text-center text-xl font-extrabold text-slate-900 dark:text-white">{exam.title}</h1>
          <p className="mt-2 text-center text-sm text-slate-500">{exam.subject} · {t('{{count}} phút', { count: exam.durationMin })} · {t('{{count}} câu', { count: exam.questions?.length || 0 })}</p>
          {isPreview ? (
            <p className="mt-4 rounded-xl bg-blue-50 p-3 text-center text-sm text-blue-800">
              {t('Chế độ thử dành cho giáo viên. Lượt này không được lưu và không ảnh hưởng số lần thi của học sinh.')}
            </p>
          ) : exam.passwordProtected && (
            <label className="mt-6 block text-xs font-semibold text-slate-600 dark:text-slate-400">{t('Mật khẩu đề thi')}
              <input type="password" value={examPassword} onChange={(event) => setExamPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3.5 py-2.5 text-sm" />
            </label>
          )}
          {!isPreview && exam.lockScreen && <p className="mt-4 text-center text-xs text-amber-700">{t('Đề thi yêu cầu bật chế độ toàn màn hình trước khi bắt đầu.')}</p>}
          {!isPreview && exam.proctorEnabled && (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-center text-xs leading-relaxed text-amber-800">
              {t('Bài thi ghi nhận một số tín hiệu từ trình duyệt như rời tab, thoát toàn màn hình và thao tác copy/dán.')}
              {' '}{t('Các tín hiệu có thể báo nhầm và không tự động kết luận vi phạm; hãy dùng trình duyệt hỗ trợ toàn màn hình.')}
            </p>
          )}
          <Button variant="primary" block loading={starting} onClick={() => void handleStart()} className="mt-6">
            {t(isPreview ? 'Bắt đầu thử đề' : 'Bắt đầu làm bài')}
          </Button>
        </section>
      </div>
    );
  }

  const questions = exam.questions || [];
  const current = questions[currentIdx];
  const currentQuestionId = current?.id ?? currentIdx + 1;

  if (isPreview && previewResult) {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-blue-200 bg-white p-8 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <Icon name="check" size={32} className="mx-auto text-emerald-500" />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">{t('Kết quả thử đề')}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{exam.title}</p>
        <p className="mt-5 text-4xl font-extrabold text-blue-600">
          {previewResult.score} / {exam.totalPoints || 10}
        </p>
        {previewResult.needsManualGrading > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            {t('{{count}} câu tự luận cần giáo viên chấm; điểm trên chỉ tính câu khách quan.', { count: previewResult.needsManualGrading })}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">{t('Lượt thử không được lưu vào hệ thống.')}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/exams')}>{t('Quay lại đề thi')}</Button>
          <Button variant="primary" onClick={() => {
            setAnswers({});
            setPreviewResult(null);
            setCurrentIdx(0);
            setSubmissionId(null);
          }}>Thử lại</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 dark:bg-slate-950 flex flex-col h-[100dvh]">
      {/* Top bar */}
      <div className="min-h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2">
        {isPreview && (
          <span className="hidden sm:inline-flex rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {t('ĐANG THỬ — KHÔNG LƯU KẾT QUẢ')}
          </span>
        )}
        <div
          className={cn(
            'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl font-bold tabular-nums text-sm sm:text-base shrink-0',
            timer.isDanger
              ? 'bg-red-50 text-red-600 animate-pulse'
              : timer.isWarning
              ? 'bg-amber-50 text-amber-600'
              : 'bg-blue-50 text-blue-600',
          )}
        >
          <Icon name="clock" size={18} />
          {timer.formatted}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
            {exam.title}
          </div>
          <div className="text-xs text-slate-500">
            {t('{{count}} câu hỏi', { count: questions.length })} {isPreview ? `• ${t('Chế độ thử')}` : exam.proctorEnabled && '• 🛡️ Proctoring Pro'}
          </div>
        </div>
        {!isPreview && exam.proctorEnabled && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-red-500">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>{t('Rời tab')}: {proctor.stats.tabSwitches}</span>
          </div>
        )}
        <Button
          variant="primary"
          size="sm"
          loading={submitting}
          onClick={() => handleSubmit()}
          icon={<Icon name="send" size={14} />}
        >
          {t('Nộp bài')}
        </Button>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Question area */}
        <div className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-6">
          <nav aria-label={t('Chuyển nhanh câu hỏi')} className="md:hidden max-w-3xl mx-auto mb-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <div className="flex justify-between items-center mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>{t('Danh sách câu hỏi')}</span>
              <span>{t('{{answered}}/{{total}} đã trả lời', { answered: questions.filter((question, i) => !!answers[question.id ?? i + 1]).length, total: questions.length })}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('Chọn câu')}>
              {questions.map((question, i) => {
                const questionId = question.id ?? i + 1;
                return <button key={questionId} type="button" aria-label={t('Đến câu {{number}}{{answered}}', { number: i + 1, answered: answers[questionId] ? `, ${t('đã trả lời')}` : '' })} aria-current={i === currentIdx ? 'step' : undefined} onClick={() => setCurrentIdx(i)} className={cn('shrink-0 min-w-11 h-11 px-2 rounded-xl border text-sm font-bold', i === currentIdx ? 'bg-blue-700 text-white border-blue-700' : flagged.has(questionId) ? 'bg-amber-50 text-amber-800 border-amber-300' : answers[questionId] ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700')}>{i + 1}</button>;
              })}
            </div>
          </nav>
          {current && (
            <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
                  {t('Câu {{number}} / {{total}}', { number: currentIdx + 1, total: questions.length })}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                  {current.type}
                </span>
              </div>

              <p className="text-base font-semibold text-slate-900 dark:text-white leading-relaxed mb-5 whitespace-pre-wrap">
                <MathText>{current.content}</MathText>
                <div className="mt-3"><QuestionImage src={current.imageUrl} alt={t('Hình minh họa câu hỏi')} /></div>
              </p>

              {current.options && current.options.length > 0 ? (
                <div className="space-y-2.5">
                  {current.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const originalIndex = optionOrder[currentQuestionId]?.[i] ?? i;
                    const savedLetter = String.fromCharCode(65 + originalIndex);
                    const isSelected = answers[currentQuestionId] === savedLetter;
                    return (
                      <button
                        key={i}
                        onClick={() => handleAnswer(currentIdx, savedLetter)}
                        className={cn(
                          'w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border-2 transition-all',
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md'
                            : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-slate-50',
                        )}
                      >
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full border-2 flex items-center justify-center flex-none text-sm font-bold',
                            isSelected
                              ? 'bg-blue-700 border-blue-700 text-white dark:bg-blue-500 dark:border-blue-500 dark:text-slate-950'
                              : 'border-slate-300 text-slate-500',
                          )}
                        >
                          {letter}
                        </div>
                        <div className="min-w-0 flex-1"><MathText className="text-sm pt-1.5">{opt}</MathText>
                          <div className="mt-2"><QuestionImage src={current.optionImages?.[i]} alt={t('Hình phương án {{letter}}', { letter })} /></div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={answers[currentQuestionId] || ''}
                  onChange={(e) => handleAnswer(currentIdx, e.target.value)}
                  placeholder={t('Nhập câu trả lời...')}
                  rows={6}
                  className="w-full p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-blue-500 resize-y bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              )}

              <div className="flex flex-wrap justify-between gap-2 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="ghost"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx(currentIdx - 1)}
                  icon={<Icon name="chevronL" size={16} />}
                >
                  {t('Câu trước')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setFlagged((currentFlags) => {
                    const next = new Set(currentFlags);
                    if (next.has(currentQuestionId)) next.delete(currentQuestionId);
                    else next.add(currentQuestionId);
                    return next;
                  })}
                  icon={<Icon name="flag" size={16} />}
                >
                  {t(flagged.has(currentQuestionId) ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại')}
                </Button>
                {currentIdx < questions.length - 1 ? (
                  <Button
                    variant="primary"
                    onClick={() => setCurrentIdx(currentIdx + 1)}
                    iconRight={<Icon name="chevronR" size={16} />}
                  >
                    {t('Câu tiếp')}
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    loading={submitting}
                    onClick={() => handleSubmit()}
                    icon={<Icon name="send" size={16} />}
                  >
                    {t('Nộp bài')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Palette */}
        <div className="hidden md:block w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-5 overflow-y-auto">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">{t('Bảng câu hỏi')}</h3>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((_, i) => {
              const questionId = _.id ?? i + 1;
              const answered = !!answers[questionId];
              const marked = flagged.has(questionId);
              const isCur = i === currentIdx;
              return (
                <button
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  aria-label={t('Đến câu {{number}}{{answered}}', { number: i + 1, answered: answered ? `, ${t('đã trả lời')}` : '' })}
                  aria-current={isCur ? 'step' : undefined}
                  className={cn(
                    'aspect-square rounded-lg text-xs font-bold transition-all',
                    isCur
                      ? 'bg-blue-700 text-white dark:bg-blue-500 dark:text-slate-950 scale-110 shadow-lg shadow-blue-500/30'
                      : marked
                      ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                      : answered
                      ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-200'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-2 border-slate-200 dark:border-slate-700',
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-4 h-4 rounded bg-emerald-100 border-2 border-emerald-200" />
              {t('Đã trả lời')}
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-4 h-4 rounded bg-blue-500" />
              {t('Câu hiện tại')}
            </div>
          </div>

          {!isPreview && exam.proctorEnabled && (
            <div className="mt-6 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-xs text-red-600">
              <div className="font-bold mb-1">🛡️ Proctoring Pro</div>
              <div>{t('Rời tab')}: {proctor.stats.tabSwitches}</div>
              <div>Copy: {proctor.stats.copyAttempts}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}