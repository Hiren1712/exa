import { apiClient, ApiResponse } from './client';
import { UserInfo } from './auth';

export interface UserProfileUpdate {
  fullName: string;
  phone?: string;
  dateOfBirth?: string;
}

export const userApi = {
  updateProfile: async (data: UserProfileUpdate): Promise<UserInfo> => {
    const res = await apiClient.put<ApiResponse<UserInfo>>('/v1/users/me', data);
    return res.data.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.put('/v1/users/me/password', { currentPassword, newPassword });
  },

  uploadProfileImage: async (type: 'avatar' | 'cover', file: File): Promise<UserInfo> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.put<ApiResponse<UserInfo>>(`/v1/users/me/${type}`, formData);
    return res.data.data;
  },

  deleteProfileImage: async (type: 'avatar' | 'cover'): Promise<UserInfo> => {
    const res = await apiClient.delete<ApiResponse<UserInfo>>(`/v1/users/me/${type}`);
    return res.data.data;
  },
};

export function profileImageUrl(imageUrl?: string): string | undefined {
  if (!imageUrl) return undefined;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;

  const configuredApiUrl = apiClient.defaults.baseURL;
  const apiOrigin = configuredApiUrl && /^https?:\/\//i.test(configuredApiUrl)
    ? new URL(configuredApiUrl).origin
    : window.location.origin;
  return new URL(imageUrl, apiOrigin).toString();
}
