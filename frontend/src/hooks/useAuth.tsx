import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, AuthResponse, LoginRequest, RegisterRequest, UserInfo } from '../api/auth';
import { useAuthStore } from '../store/auth';

type Theme = 'light' | 'dark';

interface AuthContextValue {
  user: UserInfo | null;
  loading: boolean;
  theme: Theme;
  login: (data: LoginRequest) => Promise<UserInfo>;
  register: (data: RegisterRequest) => Promise<UserInfo>;
  logout: () => void;
  toggleTheme: () => void;
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
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'light';
  });

  // Load user on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const cachedUser = localStorage.getItem('user');

    if (token && cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const login = useCallback(async (data: LoginRequest) => {
    const res: AuthResponse = await authApi.login(data);
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const res: AuthResponse = await authApi.register(data);
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser: UserInfo) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, [setUser]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, theme, login, register, logout, toggleTheme, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}