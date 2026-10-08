import { apiClient, ApiResponse } from './client';

export interface UserInfo {
  id: number;
  email: string;
  fullName: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  phone?: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  dateOfBirth?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfo;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role: 'TEACHER' | 'STUDENT';
  dateOfBirth?: string;
}

export interface GoogleLoginRequest {
  idToken: string;
  role?: 'TEACHER' | 'STUDENT';
}

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/v1/auth/login', data);
    return res.data.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/v1/auth/register', data);
    return res.data.data;
  },

  googleLogin: async (data: GoogleLoginRequest): Promise<AuthResponse> => {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/v1/auth/google', data);
    return res.data.data;
  },

  me: async (): Promise<UserInfo> => {
    const res = await apiClient.get<ApiResponse<UserInfo>>('/v1/auth/me');
    return res.data.data;
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/v1/auth/refresh', { refreshToken });
    return res.data.data;
  },
};