import { apiClient, ApiResponse } from './client';
import { Question } from './question';

export interface GenerateQuestionsRequest {
  subject: string;
  grade: number;
  topic: string;
  count: number;
  difficulty: string;
}

export interface EssayGradeSuggestion {
  score: number;
  feedback: string;
}

export const aiApi = {
  generateQuestions: async (data: GenerateQuestionsRequest): Promise<Question[]> => {
    const response = await apiClient.post<ApiResponse<Question[]>>('/v1/ai/generate-questions', data);
    return response.data.data;
  },

  gradeEssay: async (data: {
    question: string;
    answer: string;
    rubric?: string;
    maxScore: number;
  }): Promise<EssayGradeSuggestion> => {
    const response = await apiClient.post<ApiResponse<EssayGradeSuggestion>>('/v1/ai/grade-essay', data);
    return response.data.data;
  },
};
