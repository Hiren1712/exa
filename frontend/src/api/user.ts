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
};
