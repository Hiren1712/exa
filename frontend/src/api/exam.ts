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

export const examApi = {
  list: async (): Promise<ExamSummary[]> => {
    const res = await apiClient.get<ApiResponse<ExamSummary[]>>('/v1/exams');
    return res.data.data;
  },

  get: async (id: number): Promise<Exam> => {
    const res = await apiClient.get<ApiResponse<Exam>>(`/v1/exams/${id}`);
    const exam = res.data.data;
    return {
      ...exam,
      questions: exam.questions?.map((question) => {
        if (typeof question.options !== 'string') return question;
        try {
          return { ...question, options: JSON.parse(question.options) as string[] };
        } catch {
          throw new Error(`Danh sách đáp án của đề "${exam.title}" không hợp lệ`);
        }
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