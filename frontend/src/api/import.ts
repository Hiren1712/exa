import { apiClient, ApiResponse } from './client';

export interface ParsedQuestion {
  number: number;
  type: string;
  content: string;
  options: string[];
  correctAnswer: string | null;
  answerText: string | null;
  difficulty: string;
  explanation: string | null;
}

export interface ImportPreview {
  jobId: number;
  originalName: string;
  status: string;
  totalFound: number;
  questions: ParsedQuestion[];
  errorMessage?: string;
}

export type ImportMode = 'EXTRACT' | 'GENERATE';

export const importApi = {
  upload: async (
    file: File | null,
    content: string,
    subject: string,
    grade: number,
    mode: ImportMode,
    questionCount: number,
  ): Promise<number> => {
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (content.trim()) formData.append('content', content);
    formData.append('subject', subject);
    formData.append('grade', String(grade));
    formData.append('mode', mode);
    formData.append('questionCount', String(questionCount));

    const res = await apiClient.post<ApiResponse<number>>('/v1/imports/upload', formData);
    return res.data.data;
  },

  getPreview: async (jobId: number): Promise<ImportPreview> => {
    const res = await apiClient.get<ApiResponse<ImportPreview>>(`/v1/imports/${jobId}/preview`);
    return res.data.data;
  },

  saveToBank: async (
    jobId: number,
    questions: ParsedQuestion[],
    subject: string,
    grade: number,
    unit: string,
  ): Promise<number> => {
    const res = await apiClient.post<ApiResponse<number>>(`/v1/imports/${jobId}/save`, {
      questions,
      subject,
      grade,
      unit,
    });
    return res.data.data;
  },
};