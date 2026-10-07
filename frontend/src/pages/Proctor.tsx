import { useCallback, useEffect, useState } from 'react';
import { ExamSummary, examApi } from '../api/exam';
import { extractError } from '../api/client';
import { submissionApi, Submission } from '../api/submission';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { fmtDate } from '../lib/utils';

type MonitoredSubmission = Submission & { proctorEvents: Record<string, number> };

export default function Proctor() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [examId, setExamId] = useState<number | null>(null);
  const [activeSubmissions, setActiveSubmissions] = useState<MonitoredSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    examApi.list()
      .then((all) => {
        const openExams = all.filter((exam) => exam.status === 'OPEN' && exam.proctorEnabled);
        setExams(openExams);
        setExamId(openExams[0]?.id ?? null);
      })
      .catch((error) => toast('Không tải được danh sách đề thi', extractError(error), 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const refresh = useCallback(async () => {
    if (!examId) {
      setActiveSubmissions([]);
      return;
    }
    try {
      const submissions = await submissionApi.forExam(examId);
      const active = submissions.filter((submission) => submission.status === 'IN_PROGRESS');
      const monitored = await Promise.all(active.map(async (submission) => ({
        ...submission,
        proctorEvents: submission.id ? await submissionApi.proctorSummary(submission.id) : {},
      })));
      setActiveSubmissions(monitored);
      setLastUpdated(new Date());
    } catch (error) {
      toast('Không tải được dữ liệu giám sát', extractError(error), 'error');
    }
  }, [examId, toast]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const eventCount = (events: Record<string, number>) => Object.values(events).reduce((sum, count) => sum + count, 0);
  const riskLabel = (events: Record<string, number>) => {
    const switches = Object.entries(events)
      .filter(([name]) => /TAB|FOCUS|VISIBILITY/i.test(name))
      .reduce((sum, [, count]) => sum + count, 0);
    return switches >= 3 ? { label: 'Nguy cơ cao', color: 'text-red-600 bg-red-50' }
      : switches > 0 ? { label: 'Cần chú ý', color: 'text-amber-700 bg-amber-50' }
        : { label: 'Ổn định', color: 'text-emerald-700 bg-emerald-50' };
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Giám sát phòng thi</h1>
          <p className="mt-1 text-sm text-slate-500">Trạng thái được làm mới tự động mỗi 10 giây.</p>
        </div>
        <Button variant="ghost" onClick={() => void refresh()} icon={<Icon name="refresh" size={16} />}>Làm mới</Button>
      </header>

      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <label className="min-w-64 flex-1 text-xs font-semibold text-slate-500">
          Đề thi đang mở có bật giám sát
          <select value={examId ?? ''} onChange={(event) => setExamId(event.target.value ? Number(event.target.value) : null)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm text-slate-900 dark:text-white">
            <option value="">Chọn đề thi</option>
            {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
          </select>
        </label>
        <div className="text-sm text-slate-500">
          <strong className="block text-2xl text-slate-900 dark:text-white">{activeSubmissions.length}</strong>
          Học sinh đang làm
        </div>
        {lastUpdated && <span className="text-xs text-slate-400">Cập nhật {lastUpdated.toLocaleTimeString('vi-VN')}</span>}
      </section>

      {loading ? <div className="p-10 text-center text-slate-500">Đang tải...</div>
        : !exams.length ? <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">Chưa có đề thi nào đang mở và bật giám sát.</div>
          : !activeSubmissions.length ? <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">Hiện chưa có học sinh nào đang làm đề này.</div>
            : <div className="space-y-3">{activeSubmissions.map((submission) => {
              const risk = riskLabel(submission.proctorEvents);
              return (
                <article key={submission.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 grid place-items-center"><Icon name="user" size={20} /></div>
                  <div className="flex-1 min-w-48">
                    <h2 className="font-bold text-slate-900 dark:text-white">Học sinh #{submission.studentId}</h2>
                    <p className="text-xs text-slate-500 mt-1">Bắt đầu {submission.startedAt ? fmtDate(submission.startedAt) : '—'} · Bài #{submission.id}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${risk.color}`}>{risk.label}</span>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    <strong>{eventCount(submission.proctorEvents)}</strong> sự kiện
                    <div className="text-xs text-slate-400">Rời tab: {Object.entries(submission.proctorEvents).filter(([name]) => /TAB|FOCUS|VISIBILITY/i.test(name)).reduce((sum, [, count]) => sum + count, 0)}</div>
                  </div>
                </article>
              );
            })}</div>}
    </div>
  );
}
