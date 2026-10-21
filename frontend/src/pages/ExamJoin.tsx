import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { extractError } from '../api/client';
import { examApi } from '../api/exam';

export default function ExamJoin() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    examApi.resolveInvite(code)
      .then((invite) => {
        if (active) navigate(`/exam/${invite.examId}?invite=${encodeURIComponent(invite.code)}`, { replace: true });
      })
      .catch((requestError: unknown) => {
        if (active) setError(extractError(requestError));
      });
    return () => { active = false; };
  }, [code, navigate]);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {!error ? (
        <>
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Đang mở phòng thi</h1>
          <p className="mt-2 text-sm text-slate-500">Đang kiểm tra mã mời...</p>
        </>
      ) : (
        <>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Không vào được phòng thi</h1>
          <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p>
          <Link to="/exams" className="mt-5 inline-block">
            <Button variant="primary">Về danh sách bài thi</Button>
          </Link>
        </>
      )}
    </div>
  );
}
