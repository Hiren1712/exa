import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, AuthResponse, GoogleLoginRequest, LoginRequest, RegisterRequest, UserInfo } from '../api/auth';
import { useAuthStore } from '../store/auth';

export type ThemePreference = 'light' | 'dark' | 'system';
type Theme = 'light' | 'dark';

interface AuthContextValue {
  user: UserInfo | null;
  loading: boolean;
  theme: Theme;
  themePreference: ThemePreference;
  login: (data: LoginRequest) => Promise<UserInfo>;
  register: (data: RegisterRequest) => Promise<UserInfo>;
  googleLogin: (data: GoogleLoginRequest) => Promise<UserInfo>;
  logout: () => void;
  toggleTheme: () => void;
  setThemePreference: (preference: ThemePreference) => void;
  updateUser: (user: UserInfo) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(true);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'dark' || stored === 'system' ? stored : 'light';
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme: Theme = themePreference === 'system'
    ? (systemDark ? 'dark' : 'light')
    : themePreference;

  // Load user on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const cachedUser = localStorage.getItem('user');

    if (token && cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setUser(null);
        setLoading(false);
        return;
      }
    }

    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    authApi.me()
      .then((freshUser) => {
        if (!active) return;
        localStorage.setItem('user', JSON.stringify(freshUser));
        setUser(freshUser);
      })
      .catch((error: unknown) => {
        if (active) {
          console.error('Không thể đồng bộ hồ sơ từ máy chủ:', error instanceof Error ? error.message : error);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setUser]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateSystemTheme);
    return () => mediaQuery.removeEventListener('change', updateSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', themePreference);
  }, [theme, themePreference]);

  const login = useCallback(async (data: LoginRequest) => {
    const res: AuthResponse = await authApi.login(data);
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, [setUser]);

  const register = useCallback(async (data: RegisterRequest) => {
    const res: AuthResponse = await authApi.register(data);
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, [setUser]);

  const googleLogin = useCallback(async (data: GoogleLoginRequest) => {
    const res: AuthResponse = await authApi.googleLogin(data);
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, [setUser]);

  const logout = useCallback(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      void authApi.logout(accessToken).catch((error: unknown) => {
        console.error('Không thể thu hồi phiên đăng nhập trên máy chủ:', error instanceof Error ? error.message : error);
      });
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  }, [setUser]);

  const updateUser = useCallback((updatedUser: UserInfo) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, [setUser]);

  const toggleTheme = useCallback(() => {
    setThemePreference(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      theme,
      themePreference,
      login,
      register,
      googleLogin,
      logout,
      toggleTheme,
      setThemePreference,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}