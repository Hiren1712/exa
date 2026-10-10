import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { examApi, ExamSummary } from '../api/exam';
import { submissionApi, Submission } from '../api/submission';
import { extractError } from '../api/client';
import { fmtDate, EXAM_STATUS_LABELS } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SCHEDULED: 'bg-blue-50 text-blue-600',
  OPEN: 'bg-emerald-50 text-emerald-600',
  CLOSED: 'bg-amber-50 text-amber-600',
  ARCHIVED: 'bg-slate-100 text-slate-400',
};

export default function Exams() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const [data, studentSubmissions] = await Promise.all([
        examApi.list(),
        isStudent ? submissionApi.mine() : Promise.resolve([]),
      ]);
      setExams(data || []);
      setSubmissions(studentSubmissions);
    } catch (err) {
      toast('Lỗi tải đề thi', extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [isStudent, toast]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Xóa đề thi "${title}"?`)) return;
    try {
      await examApi.delete(id);
      toast('Đã xóa', title, 'success');
      loadExams();
    } catch (err) {
      toast('Lỗi', extractError(err), 'error');
    }
  };

  const handlePublish = async (id: number) => {
    try {
      await examApi.publish(id);
      toast('Đã công khai', 'Học sinh có thể làm bài', 'success');
      loadExams();
    } catch (err) {
      toast('Lỗi', extractError(err), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            {isStudent ? 'Bài tập được giao' : 'Đề thi & Bài tập'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isStudent ? 'Các đề thi đang mở cho lớp học của bạn' : 'Quản lý và giao đề cho lớp học'}
          </p>
        </div>
        {!isStudent && (
          <Link to="/exams/new">
            <Button variant="primary" icon={<Icon name="plus" size={16} />}>
              Tạo đề thi mới
            </Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="p-16 text-center">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mx-auto mb-3 text-blue-500">
            <Icon name="file" size={28} />
          </div>
          <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
            {isStudent ? 'Chưa có bài tập được giao' : 'Chưa có đề thi nào'}
          </h4>
          <p className="text-sm text-slate-400 mb-5">
            {isStudent ? 'Bài tập mới sẽ xuất hiện tại đây khi giáo viên giao đề.' : 'Bắt đầu bằng cách tạo đề thi đầu tiên của bạn'}
          </p>
          {!isStudent && (
            <Link to="/exams/new">
              <Button variant="primary" icon={<Icon name="plus" size={16} />}>
                Tạo đề thi
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLORS[exam.status] || STATUS_COLORS.DRAFT}`}>
                    {EXAM_STATUS_LABELS[exam.status] || exam.status}
                  </span>
                  <span className="text-xs text-slate-400">{fmtDate(exam.createdAt)}</span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white leading-snug mb-2 line-clamp-2">
                  {exam.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{exam.subject}</span>
                  <span>•</span>
                  <span>{exam.durationMin} phút</span>
                  <span>•</span>
                  <span>{exam.questionCount || 0} câu</span>
                </div>
              </div>

              {!isStudent && (
                <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="p-3 text-center">
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {exam.submissionCount || 0}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">Bài nộp</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {exam.status === 'OPEN' ? '🟢' : '⚪'}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">Trạng thái</div>
                  </div>
                </div>
              )}

              <div className="p-3 flex flex-wrap gap-2">
                {isStudent ? (() => {
                  const latestSubmission = submissions
                    .filter((submission) => submission.examId === exam.id)
                    .sort((a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0))[0];
                  if (latestSubmission?.status === 'IN_PROGRESS') {
                    return (
                      <button
                        onClick={() => navigate(`/exam/${exam.id}`)}
                        className="w-full py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        Tiếp tục bài làm
                      </button>
                    );
                  }
                  if (latestSubmission?.id) {
                    return (
                      <button
                        onClick={() => navigate(`/exam/${exam.id}/result?submissionId=${latestSubmission.id}`)}
                        className="w-full py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        Xem kết quả lần gần nhất
                      </button>
                    );
                  }
                  return (
                    <button
                      onClick={() => navigate(`/exam/${exam.id}`)}
                      disabled={exam.status !== 'OPEN'}
                      className="w-full py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Làm bài
                    </button>
                  );
                })() : (
                  <>
                    <button
                      onClick={() => navigate(`/exam/${exam.id}?preview=1`)}
                      className="flex-1 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      Thử đề
                    </button>
                    <button
                      onClick={() => navigate(`/exams/${exam.id}/edit`)}
                      className="flex-1 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      ✏️ Sửa
                    </button>
                    {exam.status === 'DRAFT' && (
                      <button
                        onClick={() => handlePublish(exam.id)}
                        className="flex-1 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                      >
                        🚀 Mở
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(exam.id, exam.title)}
                      className="py-2 px-3 text-xs font-semibold rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}