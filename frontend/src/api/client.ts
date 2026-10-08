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
      return 'Không thể kết nối máy chủ. Kiểm tra địa chỉ API, trạng thái backend và cấu hình CORS.';
    }
    if (error.response?.status === 405) {
      return 'Máy chủ từ chối phương thức đăng nhập (HTTP 405). Nếu đang dùng Cloudflare Pages, hãy đặt VITE_API_URL thành URL backend có hậu tố /api rồi build và deploy lại.';
    }
    if (error.response?.status === 404) {
      return 'Không tìm thấy API đăng nhập. Kiểm tra VITE_API_URL có trỏ đến backend và bao gồm đường dẫn /api.';
    }
    return data?.message || error.message || 'Lỗi không xác định';
  }
  return 'Lỗi không xác định';
}