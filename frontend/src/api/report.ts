import { apiClient, ApiResponse } from './client';

export interface ExamReport {
  examId: number;
  totalPoints: number;
  totalSubmissions: number;
  averageScore: number;
  maxScore: number;
  minScore: number;
  passRate: number;
  distribution: number[];
  rankings: {
    submissionId: number;
    studentId: number;
    score: number;
    durationSec: number;
    submittedAt: string;
  }[];
  questionAnalysis: {
    questionId: number;
    content: string;
    type: string;
    responses: number;
    correctResponses: number | null;
    accuracyRate: number | null;
  }[];
}

export interface TeacherSummary {
  examCount: number;
  submissionCount: number;
  averageScore: number | null;
}

export const reportApi = {
  getTeacherSummary: async (): Promise<TeacherSummary> => {
    const res = await apiClient.get<ApiResponse<TeacherSummary>>('/v1/reports/summary');
    return res.data.data;
  },

  getExamReport: async (examId: number): Promise<ExamReport> => {
    const res = await apiClient.get<ApiResponse<ExamReport>>(`/v1/reports/exams/${examId}`);
    return res.data.data;
  },

  exportExcel: async (examId: number): Promise<Blob> => {
    const res = await apiClient.get(`/v1/reports/exams/${examId}/export`, {
      responseType: 'blob',
    });
    return res.data;
  },
};