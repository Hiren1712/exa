import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Icon } from '../components/Icon';
import { extractError } from '../api/client';

type Mode = 'login' | 'register';

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('teacher@exa.vn');
  const [password, setPassword] = useState('password');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'TEACHER' | 'STUDENT'>('TEACHER');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const user = await login({ email, password });
        toast('Đăng nhập thành công', `Xin chào ${user.fullName}`, 'success');
      } else {
        const user = await register({ email, password, fullName, role });
        toast('Đăng ký thành công', `Chào mừng ${user.fullName}`, 'success');
      }
      navigate('/');
    } catch (err) {
      toast('Lỗi', extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-2xl shadow-blue-500/40">
              <Icon name="logo" size={28} />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">EXA</h1>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Exam Extra
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nền tảng tạo đề thi &amp; quản lý học tập
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/10 border border-white/60 dark:border-slate-800 p-8">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <Input
                label="Họ tên"
                placeholder="Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            )}

            <Input
              label="Email"
              type="email"
              placeholder="you@exa.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Mật khẩu"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  Vai trò
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['TEACHER', 'STUDENT'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        role === r
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {r === 'TEACHER' ? '👩‍🏫 Giáo viên' : '🎓 Học sinh'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={loading}
              icon={<Icon name="logout" size={16} />}
            >
              {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </Button>
          </form>

          {/* Demo accounts */}
          {mode === 'login' && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-400 text-center mb-3">Tài khoản demo</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => {
                    setEmail('teacher@exa.vn');
                    setPassword('password');
                  }}
                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left"
                >
                  <div className="font-semibold">👩‍🏫 Giáo viên</div>
                  <div className="text-[10px] text-slate-400">teacher@exa.vn</div>
                </button>
                <button
                  onClick={() => {
                    setEmail('student@exa.vn');
                    setPassword('password');
                  }}
                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left"
                >
                  <div className="font-semibold">🎓 Học sinh</div>
                  <div className="text-[10px] text-slate-400">student@exa.vn</div>
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2026 EXA — Exam Extra. Made with ❤️ in Việt Nam
        </p>
      </div>
    </div>
  );
}