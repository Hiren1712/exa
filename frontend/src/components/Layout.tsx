import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { ChatWidget } from './ChatWidget';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { profileImageUrl } from '../api/user';
import { Link } from 'react-router-dom';

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
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  );
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = user?.role === 'STUDENT' ? NAV_STUDENT : NAV_TEACHER;
  const currentPage = [...navItems].sort((a, b) => b.to.length - a.to.length).find(
    (item) => item.to === '/' ? location.pathname === '/' : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    sidebarRef.current?.toggleAttribute('inert', isMobileViewport && !sidebarOpen);
  }, [isMobileViewport, sidebarOpen]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    if (isMobileViewport) menuButtonRef.current?.focus();
  }, [isMobileViewport]);

  useEffect(() => {
    if (!sidebarOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeSidebar, sidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-[100dvh] bg-[var(--bg)] exa-surface-gradient">
      <a href="#exa-main" className="exa-skip-link">Bỏ qua điều hướng, đến nội dung</a>
      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        id="exa-sidebar"
        aria-label="Điều hướng chính"
        aria-hidden={isMobileViewport && !sidebarOpen}
        className={cn(
          'exa-sidebar fixed inset-y-0 left-0 z-40 w-[min(19rem,85vw)] flex flex-col transition-transform lg:translate-x-0 lg:w-[272px]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="exa-brand flex items-center gap-3 px-5 py-6">
          <div className="exa-brand-mark w-11 h-11 rounded-2xl text-white flex items-center justify-center">
            <Icon name="logo" size={22} />
          </div>
          <div>
            <h3 className="text-[19px] font-black tracking-[-.055em] text-slate-900 dark:text-white leading-tight">EXA<span className="text-blue-600 dark:text-blue-400">.</span></h3>
            <span className="text-xs tracking-wider text-slate-500 dark:text-slate-400 font-semibold uppercase">
              EDUCATION PLATFORM
            </span>
          </div>
          <button ref={closeButtonRef} type="button" onClick={closeSidebar} aria-label="Đóng điều hướng" className="lg:hidden ml-auto exa-icon-button"><Icon name="x" size={19} /></button>
        </div>

        <p className="exa-nav-eyebrow px-6 pt-7 pb-3 text-[10px] font-extrabold uppercase tracking-[.2em] text-slate-500 dark:text-slate-400">KHÔNG GIAN LÀM VIỆC</p>
        {/* Nav */}
        <nav className="exa-navigation flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={closeSidebar}
              className={({ isActive }) =>
                cn(
                  'exa-nav-item flex items-center gap-3 px-3.5 min-h-[46px] rounded-[13px] text-[13px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
                  isActive
                    ? 'exa-nav-active bg-blue-50 dark:bg-blue-500/15 text-blue-800 dark:text-blue-200'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
                )
              }
            >
              <Icon name={item.icon} size={18} />
              <span className="flex-1">{item.label}</span>
              <span className="exa-nav-dot" aria-hidden="true" />
            </NavLink>
          ))}
        </nav>

        {/* Pro card */}
        {user?.role !== 'STUDENT' && (
          <div className="p-3">
            <div className="exa-pro-card relative rounded-[20px] text-white p-5 overflow-hidden">
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
        <div className="exa-sidebar-footer px-5 py-4 text-[11px] font-medium text-slate-400 dark:text-slate-500">EXA 3.0 <span aria-hidden="true">·</span> Designed for learning</div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/65 backdrop-blur-[2px] lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-[272px] flex flex-col min-w-0">
        {/* Topbar */}
        <header className="exa-topbar sticky top-0 z-20 min-h-[80px] flex items-center gap-3 px-4 sm:px-7 lg:px-9">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu điều hướng"
            aria-expanded={sidebarOpen}
            aria-controls="exa-sidebar"
            className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Icon name="menu" size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500 dark:text-slate-400 hidden sm:block">WORKSPACE <span className="px-1.5">/</span> {user?.role === 'STUDENT' ? 'Học sinh' : 'Giáo viên'}</div>
            <div className="text-[15px] font-bold tracking-[-.02em] text-slate-900 dark:text-white truncate">{currentPage?.label || 'Không gian học tập'}</div>
          </div>

          <div className="hidden xl:flex exa-topbar-date items-center gap-2 mr-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Icon name="calendar" size={16} />
            <span>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}</span>
          </div>
          <Link to="/exams" className="exa-quick-link hidden sm:inline-flex items-center gap-2 min-h-10 px-3.5 text-[13px] font-semibold rounded-xl" aria-label="Đến danh sách đề thi">
            <Icon name="exaExam" size={16} /> Đề thi
          </Link>
          <span className="exa-topbar-divider hidden sm:block" aria-hidden="true" />
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
        <main id="exa-main" tabIndex={-1} className="exa-main flex-1 p-4 sm:p-7 lg:px-10 lg:py-9 max-w-[1550px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
      {user && !/^\/exam\/\d+$/.test(location.pathname) && (
        <ChatWidget key={user.id} userId={user.id} />
      )}
    </div>
  );
}