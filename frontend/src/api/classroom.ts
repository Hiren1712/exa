import { apiClient, ApiResponse } from './client';

export interface Classroom {
  id: number;
  teacherId?: number;
  name: string;
  code: string;
  subject?: string;
  grade?: number;
  description?: string;
  maxStudents: number;
  archived: boolean;
  createdAt?: string;
  memberCount?: number;
}

export interface ClassroomRequest {
  name: string;
  subject: string;
  grade: number;
  description: string;
}

export interface ClassroomMember {
  studentId: number;
  fullName: string;
  email: string;
  status: string;
  joinedAt: string;
}

export const classroomApi = {
  list: async (): Promise<Classroom[]> => {
    const res = await apiClient.get<ApiResponse<Classroom[]>>('/v1/classrooms');
    return res.data.data;
  },

  listMine: async (): Promise<Classroom[]> => {
    const res = await apiClient.get<ApiResponse<Classroom[]>>('/v1/classrooms/mine');
    return res.data.data;
  },

  get: async (id: number): Promise<Classroom> => {
    const res = await apiClient.get<ApiResponse<Classroom>>(`/v1/classrooms/${id}`);
    return res.data.data;
  },

  members: async (id: number): Promise<ClassroomMember[]> => {
    const res = await apiClient.get<ApiResponse<ClassroomMember[]>>(`/v1/classrooms/${id}/members`);
    return res.data.data;
  },

  create: async (data: ClassroomRequest): Promise<Classroom> => {
    const res = await apiClient.post<ApiResponse<Classroom>>('/v1/classrooms', data);
    return res.data.data;
  },

  update: async (id: number, data: ClassroomRequest): Promise<Classroom> => {
    const res = await apiClient.put<ApiResponse<Classroom>>(`/v1/classrooms/${id}`, data);
    return res.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/v1/classrooms/${id}`);
  },

  join: async (code: string): Promise<Classroom> => {
    const res = await apiClient.post<ApiResponse<Classroom>>('/v1/classrooms/join', { code });
    return res.data.data;
  },
};
