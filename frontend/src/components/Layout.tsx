import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { ChatWidget } from './ChatWidget';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { profileImageUrl } from '../api/user';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  teacherOnly?: boolean;
}

const NAV_TEACHER: NavItem[] = [
  { to: '/', icon: 'exaDashboard', label: 'Bảng điều khiển' },
  { to: '/exams', icon: 'exaExam', label: 'Đề thi & Bài tập' },
  { to: '/questions', icon: 'exaQuestions', label: 'Ngân hàng câu hỏi' },
  { to: '/classes', icon: 'exaClassroom', label: 'Lớp học' },
  { to: '/import', icon: 'exaImport', label: 'Import AI' },
  { to: '/reports', icon: 'exaReports', label: 'Báo cáo' },
  { to: '/grading', icon: 'exaGrading', label: 'Chấm bài tự luận' },
  { to: '/proctor', icon: 'exaProctor', label: 'Giám sát phòng thi' },
  { to: '/ai-studio', icon: 'exaAi', label: 'AI Studio Pro' },
  { to: '/settings', icon: 'exaSettings', label: 'Cài đặt' },
];

const NAV_STUDENT: NavItem[] = [
  { to: '/', icon: 'exaHome', label: 'Trang chủ' },
  { to: '/exams', icon: 'exaExam', label: 'Bài tập' },
  { to: '/classes', icon: 'exaClassroom', label: 'Lớp học' },
  { to: '/settings', icon: 'exaSettings', label: 'Cài đặt' },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = user?.role === 'STUDENT' ? NAV_STUDENT : NAV_TEACHER;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-[#f3f6fb] dark:bg-[#0a1221] exa-surface-gradient">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-white/95 dark:bg-[#111b2c] backdrop-blur-xl border-r border-slate-200 dark:border-slate-700 flex flex-col transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Icon name="logo" size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">EXA</h3>
            <span className="text-xs tracking-wider text-slate-500 dark:text-slate-400 font-semibold uppercase">
              Exam Extra
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 min-h-11 rounded-xl text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
                  isActive
                    ? 'bg-blue-100/80 dark:bg-blue-500/15 text-blue-900 dark:text-blue-200 shadow-sm ring-1 ring-blue-200/80 dark:ring-blue-700/40'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
                )
              }
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Pro card */}
        {user?.role !== 'STUDENT' && (
          <div className="p-3">
            <div className="relative rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-4 overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/10" />
              <h5 className="flex items-center gap-1.5 text-sm font-bold relative z-10">
                <Icon name="crown" size={14} />
                EXA Pro
              </h5>
              <p className="text-xs opacity-95 mt-1 relative z-10 leading-snug">
                AI soạn đề, giám sát camera &amp; báo cáo nâng cao.
              </p>
            </div>
          </div>
        )}
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Đóng menu điều hướng"
        />
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-[72px] bg-white/90 dark:bg-[#111b2c]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu điều hướng"
            className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Icon name="menu" size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-white truncate">
              Xin chào, {user?.fullName?.split(' ').slice(-1)[0] || 'bạn'} 👋
            </h1>
          </div>

          <button
            onClick={toggleTheme}
            aria-label="Chuyển chế độ sáng tối"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Đổi giao diện"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>

          <button
            onClick={handleLogout}
            aria-label="Đăng xuất khỏi EXA"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors"
            title="Đăng xuất"
          >
            <Icon name="logout" size={18} />
          </button>

          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
            {user?.avatarUrl && (
              <img
                src={profileImageUrl(user.avatarUrl)}
                alt={`Ảnh đại diện của ${user.fullName}`}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            )}
            <span>{user?.fullName?.charAt(0)?.toUpperCase() || '?'}</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
      {user && !/^\/exam\/\d+$/.test(location.pathname) && (
        <ChatWidget key={user.id} userId={user.id} />
      )}
    </div>
  );
}