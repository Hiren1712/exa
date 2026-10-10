import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
const apiBaseUrl = configuredApiUrl
  ? (configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`)
  : '/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT to every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers?.delete('Content-Type');
  }
  return config;
});

// Handle 401 → clear token, redirect login
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  code?: string;
  data: T;
  timestamp?: string;
}

export function extractError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown> | undefined;
    if (!error.response && error.code === 'ERR_NETWORK') {
      return 'Mất kết nối tới máy chủ. Hãy kiểm tra mạng rồi thử lại; nếu lỗi tiếp diễn, vui lòng báo quản trị viên.';
    }
    if (error.response?.status === 405) {
      return 'Máy chủ không hỗ trợ thao tác này (HTTP 405). Vui lòng tải lại trang và thử lại.';
    }
    if (error.response?.status === 404) {
      return 'Không tìm thấy API được yêu cầu (HTTP 404). Vui lòng tải lại trang và thử lại.';
    }
    return data?.message || error.message || 'Lỗi không xác định';
  }
  return 'Lỗi không xác định';
}