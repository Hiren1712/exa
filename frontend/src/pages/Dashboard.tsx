import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Icon } from '../components/Icon';
import { examApi, ExamSummary } from '../api/exam';
import { classroomApi, Classroom } from '../api/classroom';
import { submissionApi, Submission } from '../api/submission';
import { useToast } from '../components/Toast';
import { extractError } from '../api/client';
import { reportApi } from '../api/report';
import { fmtDate } from '../lib/utils';
import { useLanguage } from '../i18n';

export default function Dashboard() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [teacherAverage, setTeacherAverage] = useState<string>('—');
  const [teacherSubmissionCount, setTeacherSubmissionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        if (user?.role === 'STUDENT') {
          const [availableExams, studentSubmissions, studentClasses] = await Promise.all([
            examApi.list(),
            submissionApi.mine(),
            classroomApi.listMine(),
          ]);
          if (!active) return;
          setExams(availableExams);
          setSubmissions(studentSubmissions);
          setClassrooms(studentClasses);
        } else {
          const [teacherExams, teacherClasses, summary] = await Promise.all([
            examApi.list(),
            classroomApi.list(),
            reportApi.getTeacherSummary(),
          ]);
          if (!active) return;
          setExams(teacherExams);
          setClassrooms(teacherClasses);
          setTeacherAverage(summary.averageScore == null ? '—' : summary.averageScore.toFixed(1));
          setTeacherSubmissionCount(summary.submissionCount);
        }
      } catch (err) {
        if (!active) return;
        setLoadError(true);
        toast(t('Không tải được dữ liệu tổng quan'), extractError(err), 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id, user?.role, toast, t, attempt]);

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
        { icon: 'activity', label: 'Chuỗi học tập', value: t('{{count}} ngày', { count: studyStreak }), color: 'from-purple-500 to-pink-500' },
      ];

  return (
    <div className="exa-dashboard space-y-6 sm:space-y-8 animate-fade-in">
      <section className="exa-hero relative rounded-[24px] overflow-hidden text-white p-6 sm:p-8">
        <div className="exa-hero-grid" aria-hidden="true" />
        <div className="exa-hero-orbit exa-hero-orbit-one" aria-hidden="true" />
        <div className="relative z-10 flex w-full min-w-0 flex-wrap items-center justify-between gap-5">
          <div className="min-w-0 flex-1 basis-64">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-100">
              <Icon name={isTeacher ? 'graduationCap' : 'book'} size={20} />
              {t(isTeacher ? 'Giáo viên' : 'Học sinh')}
            </p>
            <h1 className="break-words text-2xl sm:text-4xl font-bold tracking-tight">
              {t('Xin chào, {{name}}!', { name: user?.fullName || '' })}
            </h1>
            <p className="mt-2 text-blue-50">{t(isTeacher ? 'Quản lý lớp học, đề thi và kết quả ở một nơi.' : 'Theo dõi tiến độ và tiếp tục hành trình học tập.')}</p>
          </div>
          <Link to={isTeacher ? '/exams/new' : '/exams'} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 font-semibold text-blue-900 hover:bg-blue-50">
            <Icon name={isTeacher ? 'plus' : 'book'} size={17} />{t(isTeacher ? 'Tạo đề thi' : 'Bài tập')}
          </Link>
        </div>
      </section>
      {loadError ? (
        <section className="exa-card p-6 flex flex-wrap justify-between items-center gap-4">
          <h2>{t('Không tải được dữ liệu tổng quan')}</h2>
          <button type="button" className="exa-quick-link rounded-xl px-4 min-h-11" onClick={() => setAttempt((value) => value + 1)}>{t('Làm mới')}</button>
        </section>
      ) : (<>
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="exa-stat-card exa-premium-card rounded-[20px] p-4 sm:p-6"
          >
            <div
              className={`exa-stat-icon w-11 h-11 rounded-[13px] bg-gradient-to-br ${stat.color} text-white flex items-center justify-center mb-4`}
            >
              <Icon name={stat.icon} size={20} />
            </div>
            <h3 className="text-[27px] sm:text-[32px] font-extrabold tracking-[-.055em] text-slate-900 dark:text-white">{loading ? <span className="inline-block w-14 h-7 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse" aria-label={t('Đang tải')} /> : stat.value}</h3>
            <p className="text-xs font-medium text-slate-500 mt-1.5">{t(stat.label)}</p>
          </div>
        ))}
      </div>

      {/* Recent exams */}
      <div className="exa-premium-card rounded-[22px] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-5 border-b border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Icon name="file" size={18} className="text-blue-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">{t(isTeacher ? 'Đề thi gần đây' : 'Bài tập được giao')}</h3>
          </div>
          <Link to="/exams" className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline underline-offset-4">
            {t('Xem tất cả →')}
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
              <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">{t('Chưa có đề thi nào')}</h4>
              <p className="text-sm text-slate-500 mb-4">{t(isTeacher ? 'Bắt đầu tạo đề thi đầu tiên của bạn' : 'Khi có bài được giao, bạn sẽ thấy tại đây.')}</p>
              {isTeacher && (
                <Link to="/exams/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800">
                  <Icon name="plus" size={16} />{t('Tạo đề thi')}
                </Link>
              )}
            </div>
          ) : (
            exams.slice(0, 5).map((exam) => (
              <div key={exam.id} className="exa-exam-row px-5 sm:px-6 py-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-500">
                  <Icon name="file" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                    {exam.title}
                  </h4>
                  <p className="text-xs font-medium text-slate-500 mt-1.5">
                    {exam.subject} • {exam.durationMin} phút • {exam.questionCount || 0} câu
                  </p>
                </div>
                <span className="hidden md:inline text-xs text-slate-500 shrink-0">{fmtDate(exam.createdAt, language === 'vi' ? 'vi-VN' : 'en-US')}</span>
                {!isTeacher && (() => {
                  const submission = latestSubmissionByExam.get(exam.id);
                  const hasSubmitted = submission && submission.status !== 'IN_PROGRESS';
                  return (
                    <Link
                      to={hasSubmitted ? `/exam/${exam.id}/result?submissionId=${submission.id}` : `/exam/${exam.id}`}
                      className="min-h-11 inline-flex items-center justify-center px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors"
                    >
                      {t(hasSubmitted ? 'Xem kết quả' : submission ? 'Tiếp tục làm' : 'Làm bài')}
                    </Link>
                  );
                })()}
              </div>
            ))
          )}
        </div>
      </div>

      </>)}

      {/* Quick actions */}
      {isTeacher ? (
        <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
          <Link to="/import" className="exa-action-ai group relative overflow-hidden rounded-[22px] p-6 sm:p-7 text-white transition-all">
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-3">
                <Icon name="wand" size={22} />
              </div>
              <h4 className="font-bold text-lg mb-1">{t('Import đề thi bằng AI')}</h4>
              <p className="text-sm text-white/85">{t('Số hoá đề từ Word/PDF → AI tách câu hỏi tự động')}</p>
            </div>
          </Link>

          <Link to="/questions" className="exa-premium-card exa-action-card group relative overflow-hidden rounded-[22px] p-6 sm:p-7 transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-3 text-blue-500">
              <Icon name="layers" size={22} />
            </div>
            <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{t('Ngân hàng câu hỏi')}</h4>
            <p className="text-sm text-slate-500">{t('Quản lý & phân loại câu hỏi theo môn, độ khó')}</p>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
          <Link to="/classes" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 hover:shadow-xl transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-500 mb-3"><Icon name="building" size={22} /></div>
            <h4 className="font-bold text-slate-900 dark:text-white">{t('Lớp học của tôi')}</h4>
            <p className="text-sm text-slate-500 mt-1">{t('Tham gia lớp học bằng mã mời từ giáo viên')}</p>
          </Link>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h4 className="font-bold text-slate-900 dark:text-white mb-3">{t('Điểm gần đây')}</h4>
            {submissions.filter((submission) => submission.totalScore != null).slice(0, 4).map((submission) => (
              <div key={submission.id} className="flex justify-between py-2 border-t border-slate-100 dark:border-slate-800 text-sm">
                <span className="text-slate-500">Đề #{submission.examId}</span>
                <strong className="text-blue-600">{submission.totalScore}</strong>
              </div>
            ))}
            {!loading && !loadError && !studentAverage.length && <p className="text-xs text-slate-500">{t('Chưa có điểm được ghi nhận.')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}