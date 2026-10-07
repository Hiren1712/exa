import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { classroomApi, Classroom, ClassroomMember } from '../api/classroom';
import { examApi, ExamSummary } from '../api/exam';
import { reportApi, ExamReport } from '../api/report';
import { extractError } from '../api/client';
import { useAuth } from '../hooks/useAuth';

type Tab = 'students' | 'assignments' | 'reports';

export default function ClassDetail() {
  const { id } = useParams();
  const classroomId = Number(id);
  const { user } = useAuth();
  const { toast } = useToast();
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [members, setMembers] = useState<ClassroomMember[]>([]);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [selectedExam, setSelectedExam] = useState<number | null>(null);
  const [report, setReport] = useState<ExamReport | null>(null);
  const [tab, setTab] = useState<Tab>(isTeacher ? 'students' : 'assignments');
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(classroomId) || classroomId < 1) {
      toast('Lớp học không hợp lệ', '', 'error');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [classData, examList] = await Promise.all([
        classroomApi.get(classroomId),
        examApi.list(),
      ]);
      setClassroom(classData);
      setExams(examList.filter((exam) => exam.classroomId === classroomId));
      if (isTeacher) {
        setMembers(await classroomApi.members(classroomId));
      }
    } catch (err) {
      toast('Không tải được chi tiết lớp', extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [classroomId, isTeacher, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab !== 'reports' || !selectedExam) {
      setReport(null);
      return;
    }
    let active = true;
    setReportLoading(true);
    reportApi.getExamReport(selectedExam)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((err: unknown) => {
        if (active) toast('Không tải được báo cáo', extractError(err), 'error');
      })
      .finally(() => {
        if (active) setReportLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, selectedExam, toast]);

  const copyInvite = async () => {
    if (!classroom) return;
    const inviteUrl = `${window.location.origin}/classes?code=${encodeURIComponent(classroom.code)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast('Đã sao chép liên kết mời', classroom.code, 'success');
    } catch (err) {
      toast('Không sao chép được liên kết', extractError(err), 'error');
    }
  };

  if (loading) {
    return <div className="p-16 text-center"><div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!classroom) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
        <p className="text-slate-500 mb-4">Không tìm thấy lớp học hoặc bạn không có quyền truy cập.</p>
        <Link to="/classes"><Button variant="primary">Quay lại danh sách lớp</Button></Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    ...(isTeacher ? [{ id: 'students' as const, label: 'Học sinh', icon: 'users' }] : []),
    { id: 'assignments', label: 'Bài tập đã giao', icon: 'file' },
    ...(isTeacher ? [{ id: 'reports' as const, label: 'Báo cáo', icon: 'chart' }] : []),
  ];

  return (
    <div className="space-y-6">
      <Link to="/classes" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600">
        <Icon name="chevronL" size={16} /> Tất cả lớp học
      </Link>

      <section className="rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white p-6 md:p-8 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-semibold bg-white/15 px-3 py-1 rounded-full">{classroom.subject || 'Chưa phân môn'}</span>
            <h1 className="mt-3 text-2xl font-extrabold">{classroom.name}</h1>
            <p className="mt-1 text-sm text-white/80">
              {classroom.grade ? `Khối ${classroom.grade} · ` : ''}{classroom.memberCount ?? members.length} học sinh
            </p>
            {classroom.description && <p className="mt-3 max-w-2xl text-sm text-white/85">{classroom.description}</p>}
          </div>
          {isTeacher && (
            <Button variant="ghost" className="!bg-white !text-blue-700 !border-transparent" icon={<Icon name="copy" size={16} />} onClick={() => void copyInvite()}>
              Sao chép link mời
            </Button>
          )}
        </div>
        <div className="mt-5 inline-flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2">
          <span className="text-xs text-white/75">Mã tham gia</span>
          <code className="font-mono font-bold tracking-wide">{classroom.code}</code>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap ${
              tab === item.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon name={item.icon} size={16} /> {item.label}
          </button>
        ))}
      </div>

      {tab === 'students' && isTeacher && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white">Danh sách học sinh ({members.length})</h2>
            <Button variant="primary" size="sm" icon={<Icon name="copy" size={14} />} onClick={() => void copyInvite()}>Mời học sinh</Button>
          </div>
          {members.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Chưa có học sinh. Sao chép mã lớp để gửi lời mời.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
                  <tr><th className="text-left p-4">Học sinh</th><th className="text-left p-4">Email</th><th className="text-left p-4">Ngày tham gia</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((member) => (
                    <tr key={member.studentId}>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{member.fullName}</td>
                      <td className="p-4 text-slate-500">{member.email}</td>
                      <td className="p-4 text-slate-500">{new Date(member.joinedAt).toLocaleDateString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'assignments' && (
        <div className="space-y-3">
          {exams.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
              Chưa có đề thi nào được giao cho lớp này.
              {isTeacher && <div className="mt-4"><Link to={`/exams/new?classroomId=${classroom.id}`}><Button variant="primary">Tạo đề cho lớp</Button></Link></div>}
            </div>
          ) : exams.map((exam) => (
            <div key={exam.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center"><Icon name="file" /></div>
              <div className="flex-1 min-w-48">
                <h3 className="font-bold text-slate-900 dark:text-white">{exam.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{exam.subject} · {exam.durationMin} phút · {exam.questionCount ?? 0} câu</p>
              </div>
              <span className="text-xs rounded-full px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{exam.status}</span>
              <Link to={isTeacher ? `/exams/${exam.id}/edit` : `/exam/${exam.id}`}>
                <Button size="sm" variant={isTeacher ? 'ghost' : 'primary'}>{isTeacher ? 'Quản lý' : 'Mở bài tập'}</Button>
              </Link>
            </div>
          ))}
        </div>
      )}

      {tab === 'reports' && isTeacher && (
        <section className="space-y-4">
          <div className="max-w-md">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Chọn đề thi</label>
            <select
              value={selectedExam ?? ''}
              onChange={(event) => setSelectedExam(event.target.value ? Number(event.target.value) : null)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="">Chọn đề thi trong lớp</option>
              {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
            </select>
          </div>
          {reportLoading ? (
            <div className="p-10 text-center"><div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : report ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Bài nộp', report.totalSubmissions],
                ['Điểm trung bình', report.averageScore],
                ['Điểm cao nhất', report.maxScore],
                ['Tỉ lệ đạt', `${report.passRate}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{value}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500">Chọn đề thi để xem báo cáo.</p>}
        </section>
      )}
    </div>
  );
}
