import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { submissionApi, SubmissionReview } from '../api/submission';

export default function ExamResult() {
  const [params] = useSearchParams();
  const [review, setReview] = useState<SubmissionReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const submissionId = Number(params.get('submissionId'));

  useEffect(() => {
    if (!Number.isSafeInteger(submissionId) || submissionId < 1) {
      setError('Không tìm thấy mã bài nộp.');
      setLoading(false);
      return;
    }
    let active = true;
    submissionApi.review(submissionId)
      .then((data) => {
        if (active) setReview(data);
      })
      .catch(() => {
        if (active) setError('Không thể tải kết quả bài thi. Vui lòng kiểm tra quyền truy cập hoặc thử lại.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [submissionId]);

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Đang tải kết quả bài thi...</div>;
  }
  if (error || !review) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <p>{error || 'Không có dữ liệu kết quả.'}</p>
        <Link to="/exams" className="mt-4 inline-block font-semibold">Quay lại danh sách đề thi</Link>
      </div>
    );
  }

  const score = review.totalScore ?? 0;
  const totalPoints = review.totalPoints || 10;
  const pct = Math.max(0, Math.min(100, (score / totalPoints) * 100));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white p-10 text-center shadow-2xl">
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-white/10" />
        <div className="relative z-10">
          <div className="w-36 h-36 rounded-full mx-auto mb-5 grid place-items-center" style={{ background: `conic-gradient(#fff ${pct}%, rgba(255,255,255,.22) 0)` }}>
            <div className="w-28 h-28 rounded-full bg-slate-900/40 backdrop-blur-md grid place-items-center flex-col">
              <div className="text-4xl font-extrabold leading-none">{review.totalScore ?? '—'}</div>
              <div className="text-[10px] uppercase tracking-wider opacity-85 mt-1">Điểm</div>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold mb-1">{review.examTitle}</h1>
          <p className="opacity-90 text-sm">Bài thi đã được nộp</p>
          {review.needsManualGrading && <p className="mt-2 text-sm font-semibold">Câu tự luận đang chờ giáo viên chấm.</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-2"><Icon name="check" size={20} /></div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{review.totalScore ?? '—'} / {totalPoints}</div>
          <div className="text-xs text-slate-500">Điểm số</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-2"><Icon name="clock" size={20} /></div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{review.durationSec == null ? '—' : Math.ceil(review.durationSec / 60)}</div>
          <div className="text-xs text-slate-500">Phút làm bài</div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4">Chi tiết bài làm</h2>
        {review.needsManualGrading && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Điểm tổng sẽ hiển thị sau khi giáo viên chấm xong phần tự luận.</p>}
        {review.teacherFeedback && <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800"><strong>Nhận xét của giáo viên:</strong> {review.teacherFeedback}</p>}
        {!review.answersRevealed && <p className="mb-4 text-sm text-amber-700">Đáp án và lời giải sẽ hiển thị theo cài đặt của giáo viên.</p>}
        <div className="space-y-4">
          {review.questions.map((question, index) => {
            let options: string[] = [];
            if (question.options) {
              try {
                options = typeof question.options === 'string' ? JSON.parse(question.options) as string[] : [];
              } catch {
                options = [];
              }
            }
            return (
              <article key={question.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-4">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{index + 1}. {question.content}</h3>
                {options.length > 0 && <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">{options.map((option, optionIndex) => <li key={optionIndex}>{option}</li>)}</ul>}
                <p className="mt-3 text-sm"><span className="text-slate-500">Câu trả lời của bạn: </span><strong>{question.studentAnswer || 'Chưa trả lời'}</strong></p>
                {review.answersRevealed && (
                  <>
                    {question.correctAnswer && <p className="mt-1 text-sm text-emerald-700"><span className="text-slate-500">Đáp án đúng: </span><strong>{question.correctAnswer}</strong></p>}
                    {question.answerText && <p className="mt-1 text-sm text-emerald-700"><span className="text-slate-500">Đáp án: </span><strong>{question.answerText}</strong></p>}
                    {question.explanation && <p className="mt-2 text-sm text-slate-500">{question.explanation}</p>}
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <div className="flex gap-3">
        <Link to="/" className="flex-1"><Button variant="ghost" block icon={<Icon name="home" size={16} />}>Về trang chủ</Button></Link>
        <Link to="/exams" className="flex-1"><Button variant="primary" block icon={<Icon name="file" size={16} />}>Xem đề khác</Button></Link>
      </div>
    </div>
  );
}
