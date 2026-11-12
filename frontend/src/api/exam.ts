import { apiClient, ApiResponse } from './client';
import { Question } from './question';

export interface Exam {
  id?: number;
  title: string;
  description?: string;
  subject: string;
  classroomId?: number;
  durationMin: number;
  totalPoints: number;
  status: 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  proctorEnabled: boolean;
  lockScreen: boolean;
  maxAttempts: number;
  password?: string;
  passwordProtected?: boolean;
  showAnswerAfter?: string;
  questionIds?: number[];
  questions?: Question[];
  createdAt?: string;
}

export interface ExamSummary {
  id: number;
  classroomId?: number;
  title: string;
  subject: string;
  status: string;
  durationMin: number;
  questionCount: number;
  submissionCount: number;
  proctorEnabled: boolean;
  createdAt: string;
}

export interface ExamInvite {
  examId: number;
  title: string;
  status: string;
  code: string;
}

export const examApi = {
  list: async (): Promise<ExamSummary[]> => {
    const res = await apiClient.get<ApiResponse<ExamSummary[]>>('/v1/exams');
    return res.data.data;
  },

  get: async (id: number, inviteCode?: string): Promise<Exam> => {
    const res = await apiClient.get<ApiResponse<Exam>>(`/v1/exams/${id}`, {
      params: inviteCode ? { inviteCode } : undefined,
    });
    const exam = res.data.data;
    return {
      ...exam,
      questions: exam.questions?.map((question) => {
        const parse = (value: string[] | string | undefined, field: string): string[] | undefined => {
          if (typeof value !== 'string') return value;
          try { return JSON.parse(value) as string[]; }
          catch { throw new Error(`${field} của đề "${exam.title}" không hợp lệ`); }
        };
        return {
          ...question,
          options: parse(question.options, 'Danh sách đáp án'),
          optionImages: parse(question.optionImages, 'Danh sách hình ảnh'),
        };
      }),
    };
  },

  create: async (data: Exam): Promise<Exam> => {
    const res = await apiClient.post<ApiResponse<Exam>>('/v1/exams', data);
    return res.data.data;
  },

  update: async (id: number, data: Exam): Promise<Exam> => {
    const res = await apiClient.put<ApiResponse<Exam>>(`/v1/exams/${id}`, data);
    return res.data.data;
  },

  publish: async (id: number): Promise<void> => {
    await apiClient.patch(`/v1/exams/${id}/publish`);
  },

  getInvite: async (id: number): Promise<ExamInvite> => {
    const res = await apiClient.get<ApiResponse<ExamInvite>>(`/v1/exams/${id}/invite`);
    return res.data.data;
  },

  resolveInvite: async (code: string): Promise<ExamInvite> => {
    const res = await apiClient.get<ApiResponse<ExamInvite>>(
      `/v1/exams/join/${encodeURIComponent(code.trim().toUpperCase())}`,
    );
    return res.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/v1/exams/${id}`);
  },

  addQuestions: async (id: number, questionIds: number[]): Promise<void> => {
    await apiClient.post(`/v1/exams/${id}/questions`, { questionIds });
  },

  removeQuestion: async (id: number, questionId: number): Promise<void> => {
    await apiClient.delete(`/v1/exams/${id}/questions/${questionId}`);
  },

  reorderQuestions: async (id: number, questionIds: number[]): Promise<void> => {
    await apiClient.put(`/v1/exams/${id}/questions/reorder`, { questionIds });
  },
};