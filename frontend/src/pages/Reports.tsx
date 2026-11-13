import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { examApi, ExamSummary } from '../api/exam';
import { ExamReport, reportApi } from '../api/report';
import { extractError } from '../api/client';

export default function Reports() {
  const { toast } = useToast();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [examId, setExamId] = useState<number | null>(null);
  const [report, setReport] = useState<ExamReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    examApi.list()
      .then((items) => {
        setExams(items);
        if (items.length) setExamId(items[0].id);
      })
      .catch((err: unknown) => toast('Không tải được danh sách đề thi', extractError(err), 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    if (!examId) {
      setReport(null);
      return;
    }
    let active = true;
    setLoading(true);
    reportApi.getExamReport(examId)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((err: unknown) => {
        if (active) toast('Không tải được báo cáo', extractError(err), 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [examId, toast]);

  const exportExcel = async () => {
    if (!examId) return;
    setExporting(true);
    try {
      const blob = await reportApi.exportExcel(examId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bang-diem-exa-${examId}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast('Đã xuất bảng điểm', '', 'success');
    } catch (err) {
      toast('Không xuất được bảng điểm', extractError(err), 'error');
    } finally {
      setExporting(false);
    }
  };

  const distribution = report?.distribution.map((count, index) => {
    const bucketWidth = (report.totalPoints || 10) / report.distribution.length;
    const start = (index * bucketWidth).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    const end = ((index + 1) * bucketWidth).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    return { score: `${start}–${end}`, count };
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Báo cáo &amp; Thống kê</h1>
        <p className="text-sm text-slate-500 mt-0.5">Phổ điểm, tỉ lệ đúng/sai và năng lực học sinh</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex-1 min-w-64">
          <label className="block text-xs font-semibold text-slate-500 mb-2">Chọn đề thi</label>
          <select value={examId ?? ''} onChange={(event) => setExamId(event.target.value ? Number(event.target.value) : null)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm">
            <option value="">Chọn đề thi</option>
            {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
          </select>
        </div>
        <Button variant="primary" loading={exporting} disabled={!examId} icon={<Icon name="download" size={16} />} onClick={() => void exportExcel()}>Xuất Excel</Button>
        <Button variant="ghost" disabled={!examId || !report} icon={<Icon name="file" size={16} />} onClick={() => window.print()}>In / Lưu PDF</Button>
      </div>

      {loading ? (
        <div className="p-16 text-center"><div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : !report ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center text-sm text-slate-500">
          {exams.length ? 'Chọn một đề thi để xem báo cáo.' : 'Chưa có đề thi để thống kê.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Bài đã nộp', value: report.totalSubmissions, icon: 'file' },
              { label: 'Điểm trung bình', value: Number(report.averageScore).toFixed(1), icon: 'activity' },
              { label: 'Điểm cao nhất', value: Number(report.maxScore).toFixed(1), icon: 'trophy' },
              { label: 'Tỉ lệ đạt', value: `${report.passRate}%`, icon: 'target' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <Icon name={stat.icon} className="text-blue-500" />
                <div className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-white">{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="font-bold text-slate-900 dark:text-white mb-4">Phổ điểm</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="score" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Số học sinh" fill="#3b6bff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white">Bảng xếp hạng</h2>
            </div>
            {!report.rankings.length ? (
              <p className="p-8 text-center text-sm text-slate-500">Chưa có bài làm được chấm.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
                    <tr><th className="p-4 text-left">Hạng</th><th className="p-4 text-left">Học sinh</th><th className="p-4 text-left">Điểm</th><th className="p-4 text-left">Thời gian</th><th className="p-4 text-left">Nộp lúc</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.rankings.slice(0, 10).map((row, index) => (
                      <tr key={row.submissionId}>
                        <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{index + 1}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-400">Học sinh #{row.studentId}</td>
                        <td className="p-4 font-bold text-blue-600">{Number(row.score).toFixed(1)}</td>
                        <td className="p-4 text-slate-500">{Math.round(row.durationSec / 60)} phút</td>
                        <td className="p-4 text-slate-500">{row.submittedAt ? new Date(row.submittedAt).toLocaleString('vi-VN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white">Phân tích từng câu</h2>
            </div>
            {!report.questionAnalysis.length ? (
              <p className="p-8 text-center text-sm text-slate-500">Đề thi chưa có dữ liệu phân tích.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.questionAnalysis.map((question, index) => (
                  <div key={question.questionId} className="p-4 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Câu {index + 1} · {question.type}</p>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{question.content}</p>
                    </div>
                    <span className="text-xs text-slate-500">{question.responses} lượt trả lời</span>
                    {question.accuracyRate == null
                      ? <span className="text-xs text-slate-400">Chưa có tỉ lệ đúng</span>
                      : <strong className="min-w-16 text-right text-sm text-blue-600">{question.accuracyRate}% đúng</strong>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}