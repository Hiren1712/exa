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

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const aiApi = {
  chat: async (messages: ChatTurn[]): Promise<string> => {
    const response = await apiClient.post<ApiResponse<{ reply: string }>>(
      '/v1/ai/chat',
      { messages },
      { timeout: 90_000 },
    );
    return response.data.data.reply;
  },

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
