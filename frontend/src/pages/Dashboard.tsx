import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { examApi, ExamSummary } from '../api/exam';
import { classroomApi, Classroom } from '../api/classroom';
import { submissionApi, Submission } from '../api/submission';
import { useToast } from '../components/Toast';
import { extractError } from '../api/client';
import { reportApi } from '../api/report';
import { fmtDate } from '../lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [teacherAverage, setTeacherAverage] = useState<string>('—');
  const [teacherSubmissionCount, setTeacherSubmissionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        if (user?.role === 'STUDENT') {
          const [availableExams, studentSubmissions, studentClasses] = await Promise.all([
            examApi.list(),
            submissionApi.mine(),
            classroomApi.listMine(),
          ]);
          setExams(availableExams);
          setSubmissions(studentSubmissions);
          setClassrooms(studentClasses);
        } else {
          const [teacherExams, teacherClasses, summary] = await Promise.all([
            examApi.list(),
            classroomApi.list(),
            reportApi.getTeacherSummary(),
          ]);
          setExams(teacherExams);
          setClassrooms(teacherClasses);
          setTeacherAverage(summary.averageScore == null ? '—' : summary.averageScore.toFixed(1));
          setTeacherSubmissionCount(summary.submissionCount);
        }
      } catch (err) {
        toast('Không tải được dữ liệu tổng quan', extractError(err), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.role, toast]);

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const submittedExamIds = new Set(submissions.filter((submission) => submission.status !== 'IN_PROGRESS').map((submission) => submission.examId));
  const latestSubmissionByExam = new Map<number, Submission>();
  for (const submission of submissions) {
    const previous = latestSubmissionByExam.get(submission.examId);
    if (!previous || (submission.attemptNumber || 0) > (previous.attemptNumber || 0)) {
      latestSubmissionByExam.set(submission.examId, submission);
    }
  }
  const studentAverage = submissions.filter((submission) => submission.totalScore != null);
  const averageScore = studentAverage.length
    ? (studentAverage.reduce((total, submission) => total + (submission.totalScore || 0), 0) / studentAverage.length).toFixed(1)
    : '—';
  const submissionDays = new Set(submissions
    .filter((submission) => submission.submittedAt)
    .map((submission) => {
      const date = new Date(submission.submittedAt!);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }));
  const streakStart = new Date();
  if (!submissionDays.has(`${streakStart.getFullYear()}-${streakStart.getMonth()}-${streakStart.getDate()}`)) {
    streakStart.setDate(streakStart.getDate() - 1);
  }
  let studyStreak = 0;
  while (submissionDays.has(`${streakStart.getFullYear()}-${streakStart.getMonth()}-${streakStart.getDate()}`)) {
    studyStreak += 1;
    streakStart.setDate(streakStart.getDate() - 1);
  }
  const stats = isTeacher
    ? [
        { icon: 'file', label: 'Đề thi', value: exams.length, color: 'from-blue-500 to-indigo-500' },
      { icon: 'building', label: 'Lớp học', value: classrooms.length, color: 'from-purple-500 to-pink-500' },
        { icon: 'check', label: 'Bài nộp', value: teacherSubmissionCount, color: 'from-emerald-500 to-teal-500' },
        { icon: 'trophy', label: 'Điểm TB', value: teacherAverage, color: 'from-amber-500 to-orange-500' },
      ]
    : [
        { icon: 'trophy', label: 'Điểm trung bình', value: averageScore, color: 'from-amber-500 to-orange-500' },
        { icon: 'check', label: 'Bài đã làm', value: submittedExamIds.size, color: 'from-emerald-500 to-teal-500' },
        { icon: 'clock', label: 'Bài đang chờ', value: exams.filter((exam) => !submittedExamIds.has(exam.id)).length, color: 'from-blue-500 to-indigo-500' },
        { icon: 'activity', label: 'Chuỗi học tập', value: `${studyStreak} ngày`, color: 'from-purple-500 to-pink-500' },
      ];

  return (
    <div className="space-y-6">
      {/* Welcome Hero */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white p-7 shadow-2xl shadow-blue-500/20">
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full bg-white/10" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl">
            {isTeacher ? '👩‍🏫' : '🎓'}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold mb-1">
              Xin chào, {user?.fullName}!
            </h1>
            <p className="text-white/85 text-sm">
              {isTeacher
                ? 'Chào mừng trở lại. Hãy tạo đề thi và giao bài cho học sinh.'
                : 'Bạn có bài tập đang chờ. Hãy hoàn thành nhé!'}
            </p>
          </div>
          {isTeacher && (
            <Link to="/exams/new">
              <Button
                variant="primary"
                size="lg"
                icon={<Icon name="plus" size={16} />}
                className="!bg-white !text-blue-700 !shadow-lg !shadow-indigo-950/30 hover:!bg-blue-50 hover:!text-blue-800 focus-visible:!outline-white"
              >
                Tạo đề thi
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-lg transition-shadow"
          >
            <div
              className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.color} text-white flex items-center justify-center mb-3 shadow-lg`}
            >
              <Icon name={stat.icon} size={20} />
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">{stat.value}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent exams */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Icon name="file" size={18} className="text-blue-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">{isTeacher ? 'Đề thi gần đây' : 'Bài tập được giao'}</h3>
          </div>
          <Link to="/exams" className="text-xs font-semibold text-blue-500 hover:text-blue-600">
            Xem tất cả →
          </Link>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">
              <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : exams.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <Icon name="file" size={26} className="text-slate-400" />
              </div>
              <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">Chưa có đề thi nào</h4>
              <p className="text-sm text-slate-400 mb-4">Bắt đầu tạo đề thi đầu tiên của bạn</p>
              {isTeacher && (
                <Link to="/exams/new">
                  <Button variant="primary" icon={<Icon name="plus" size={16} />}>
                    Tạo đề thi
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            exams.slice(0, 5).map((exam) => (
              <div key={exam.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-500">
                  <Icon name="file" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                    {exam.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {exam.subject} • {exam.durationMin} phút • {exam.questionCount || 0} câu
                  </p>
                </div>
                <span className="text-xs text-slate-400">{fmtDate(exam.createdAt)}</span>
                {!isTeacher && (() => {
                  const submission = latestSubmissionByExam.get(exam.id);
                  const hasSubmitted = submission && submission.status !== 'IN_PROGRESS';
                  return (
                    <Link
                      to={hasSubmitted ? `/exam/${exam.id}/result?submissionId=${submission.id}` : `/exam/${exam.id}`}
                      className="text-xs font-semibold text-blue-600"
                    >
                      {hasSubmitted ? 'Xem kết quả' : submission ? 'Tiếp tục làm' : 'Làm bài'}
                    </Link>
                  );
                })()}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick actions */}
      {isTeacher ? (
        <div className="grid md:grid-cols-2 gap-4">
          <Link to="/import" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 p-6 text-white shadow-xl shadow-purple-500/20 hover:shadow-purple-500/40 transition-all">
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-3">
                <Icon name="wand" size={22} />
              </div>
              <h4 className="font-bold text-lg mb-1">Import đề thi bằng AI</h4>
              <p className="text-sm text-white/85">Số hoá đề từ Word/PDF → AI tách câu hỏi tự động</p>
            </div>
          </Link>

          <Link to="/questions" className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 hover:shadow-xl transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-3 text-blue-500">
              <Icon name="layers" size={22} />
            </div>
            <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Ngân hàng câu hỏi</h4>
            <p className="text-sm text-slate-500">Quản lý &amp; phân loại câu hỏi theo môn, độ khó</p>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <Link to="/classes" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 hover:shadow-xl transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-500 mb-3"><Icon name="building" size={22} /></div>
            <h4 className="font-bold text-slate-900 dark:text-white">Lớp học của tôi</h4>
            <p className="text-sm text-slate-500 mt-1">Tham gia lớp học bằng mã mời từ giáo viên</p>
          </Link>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h4 className="font-bold text-slate-900 dark:text-white mb-3">Điểm gần đây</h4>
            {submissions.filter((submission) => submission.totalScore != null).slice(0, 4).map((submission) => (
              <div key={submission.id} className="flex justify-between py-2 border-t border-slate-100 dark:border-slate-800 text-sm">
                <span className="text-slate-500">Đề #{submission.examId}</span>
                <strong className="text-blue-600">{submission.totalScore}</strong>
              </div>
            ))}
            {!studentAverage.length && <p className="text-xs text-slate-500">Chưa có điểm được ghi nhận.</p>}
          </div>
        </div>
      )}
    </div>
  );
}