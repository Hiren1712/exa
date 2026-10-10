import { apiClient, ApiResponse } from './client';

export type Difficulty = 'RECOGNITION' | 'COMPREHENSION' | 'APPLICATION' | 'HIGH_APPLICATION';
export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';

export interface Question {
  id?: number;
  subject: string;
  grade?: number;
  unit?: string;
  difficulty: Difficulty;
  type: QuestionType;
  content: string;
  options?: string[];
  correctAnswer?: string;
  answerText?: string;
  explanation?: string;
  points?: number;
}

export interface QuestionFilter {
  subject?: string;
  grade?: number;
  difficulty?: Difficulty;
  type?: QuestionType;
  keyword?: string;
  page?: number;
  size?: number;
}

type QuestionResponse = Omit<Question, 'options'> & { options?: string[] | string | null };

function normalizeQuestion(question: QuestionResponse): Question {
  let options = question.options;
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options) as string[];
    } catch {
      throw new Error(`Dữ liệu đáp án câu hỏi ${question.id ?? ''} không hợp lệ`);
    }
  }
  if (options != null && (!Array.isArray(options) || options.some((option) => typeof option !== 'string'))) {
    throw new Error(`Dữ liệu đáp án câu hỏi ${question.id ?? ''} không hợp lệ`);
  }
  return { ...question, options: options ?? undefined };
}

export const questionApi = {
  list: async (filter: QuestionFilter = {}) => {
    const res = await apiClient.get<ApiResponse<{ content: QuestionResponse[]; totalElements: number }>>(
      '/v1/questions',
      { params: filter }
    );
    return { ...res.data.data, content: res.data.data.content.map(normalizeQuestion) };
  },

  get: async (id: number): Promise<Question> => {
    const res = await apiClient.get<ApiResponse<QuestionResponse>>(`/v1/questions/${id}`);
    return normalizeQuestion(res.data.data);
  },

  create: async (data: Question): Promise<Question> => {
    const res = await apiClient.post<ApiResponse<QuestionResponse>>('/v1/questions', data);
    return normalizeQuestion(res.data.data);
  },

  update: async (id: number, data: Question): Promise<Question> => {
    const res = await apiClient.put<ApiResponse<QuestionResponse>>(`/v1/questions/${id}`, data);
    return normalizeQuestion(res.data.data);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/v1/questions/${id}`);
  },

  bulkDelete: async (ids: number[]): Promise<number> => {
    const res = await apiClient.post<ApiResponse<number>>('/v1/questions/bulk-delete', { ids });
    return res.data.data;
  },
};