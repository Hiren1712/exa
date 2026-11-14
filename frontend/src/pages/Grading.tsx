import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { extractError } from '../api/client';
import { GradingItem, submissionApi } from '../api/submission';
import { fmtDate } from '../lib/utils';
import { useLanguage } from '../i18n';

export default function Grading() {
  const [items, setItems] = useState<GradingItem[]>([]);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const { toast } = useToast();
  const { language, t } = useLanguage();

  const loadQueue = useCallback(async () => {
    try {
      const queue = await submissionApi.gradingQueue();
      setItems(queue);
      setScores(Object.fromEntries(queue.map((item) => [item.submissionId, String(item.currentScore ?? '')])));
    } catch (error) {
      toast(t('Không tải được bài cần chấm'), extractError(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const saveGrade = async (item: GradingItem) => {
    const score = Number(scores[item.submissionId]);
    if (!Number.isFinite(score) || score < 0 || score > item.totalPoints) {
      toast(t('Điểm không hợp lệ'), t('Điểm cuối cùng phải nằm trong khoảng 0 đến {{points}}.', { points: item.totalPoints }), 'warn');
      return;
    }
    setSavingId(item.submissionId);
    try {
      await submissionApi.grade(item.submissionId, score, feedback[item.submissionId] || '');
      setItems((current) => current.filter((row) => row.submissionId !== item.submissionId));
      toast(t('Đã lưu điểm'), t('Đã chấm bài của học sinh #{{id}}.', { id: item.studentId }), 'success');
    } catch (error) {
      toast(t('Không thể lưu điểm'), extractError(error), 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{t('Chấm bài tự luận')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('Bài nộp chứa câu tự luận được liệt kê tại đây để giáo viên chấm điểm và nhận xét.')}</p>
      </header>

      {loading ? (
        <div className="p-10 text-center text-slate-500">{t('Đang tải bài cần chấm...')}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
          <Icon name="check" size={28} className="mx-auto mb-3 text-emerald-500" />
          <h2 className="font-bold text-slate-900 dark:text-white">{t('Không có bài cần chấm')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('Các bài nộp tự luận mới sẽ xuất hiện ở đây.')}</p>
        </div>
      ) : items.map((item) => (
        <article key={item.submissionId} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <header className="flex flex-wrap justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">{item.examTitle}</h2>
              <p className="text-xs text-slate-500 mt-1">{t('Học sinh #{{id}} · Nộp lúc {{date}}', { id: item.studentId, date: fmtDate(item.submittedAt, language === 'en' ? 'en-US' : 'vi-VN') })}</p>
            </div>
            <span className="text-xs text-slate-500">Bài nộp #{item.submissionId}</span>
          </header>
          <div className="space-y-3">
            {item.essayResponses.map((question, index) => (
              <div key={question.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('Câu tự luận {{number}}:', { number: index + 1 })} {question.content}</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{question.studentAnswer || t('Học sinh không trả lời câu này.')}</p>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-[180px_1fr] gap-3">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {t('Điểm cuối cùng (0–{{points}})', { points: item.totalPoints })}
              <input
                type="number"
                min="0"
                max={item.totalPoints}
                step="0.25"
                value={scores[item.submissionId] ?? ''}
                onChange={(event) => setScores((current) => ({ ...current, [item.submissionId]: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {t('Nhận xét cho học sinh')}
              <textarea
                maxLength={4000}
                rows={3}
                value={feedback[item.submissionId] ?? ''}
                onChange={(event) => setFeedback((current) => ({ ...current, [item.submissionId]: event.target.value }))}
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" loading={savingId === item.submissionId} onClick={() => void saveGrade(item)} icon={<Icon name="save" size={16} />}>{t('Lưu điểm và nhận xét')}</Button>
          </div>
        </article>
      ))}
    </div>
  );
}
