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
  { to: '/', icon: 'grid', label: 'Bảng điều khiển' },
  { to: '/exams', icon: 'file', label: 'Đề thi & Bài tập' },
  { to: '/questions', icon: 'layers', label: 'Ngân hàng câu hỏi' },
  { to: '/classes', icon: 'building', label: 'Lớp học' },
  { to: '/import', icon: 'wand', label: 'Import AI' },
  { to: '/reports', icon: 'chart', label: 'Báo cáo' },
  { to: '/grading', icon: 'check', label: 'Chấm bài tự luận' },
  { to: '/proctor', icon: 'shield', label: 'Giám sát phòng thi' },
  { to: '/ai-studio', icon: 'sparkle', label: 'AI Studio Pro' },
  { to: '/settings', icon: 'settings', label: 'Cài đặt' },
];

const NAV_STUDENT: NavItem[] = [
  { to: '/', icon: 'home', label: 'Trang chủ' },
  { to: '/exams', icon: 'file', label: 'Bài tập' },
  { to: '/classes', icon: 'building', label: 'Lớp học' },
  { to: '/settings', icon: 'settings', label: 'Cài đặt' },
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
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform lg:translate-x-0',
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
            <span className="text-[10px] tracking-wider text-slate-400 font-semibold uppercase">
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
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
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
              <p className="text-[11px] opacity-90 mt-1 relative z-10 leading-snug">
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
        />
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-5">
          <button
            onClick={() => setSidebarOpen(true)}
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
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Đổi giao diện"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>

          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors"
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
        <main className="flex-1 p-5 lg:p-7 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
      {user && !/^\/exam\/\d+$/.test(location.pathname) && (
        <ChatWidget key={user.id} userId={user.id} />
      )}
    </div>
  );
}