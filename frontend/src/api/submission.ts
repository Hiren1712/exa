import { apiClient, ApiResponse } from './client';

export interface Submission {
  id?: number;
  examId: number;
  studentId?: number;
  attemptNumber?: number;
  startedAt?: string;
  submittedAt?: string;
  durationSec?: number;
  totalScore?: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'AUTO_SUBMITTED';
  answers?: SubmissionAnswer[] | string;
}

export interface SubmissionAnswer {
  questionId: number;
  answerData: string;
  isCorrect?: boolean;
  pointsEarned?: number;
}

export interface SubmissionReview {
  examTitle: string;
  totalScore: number | null;
  totalPoints: number;
  durationSec: number | null;
  answersRevealed: boolean;
  needsManualGrading: boolean;
  teacherFeedback?: string | null;
  questions: Array<{
    id: number;
    type: string;
    content: string;
    options?: string | null;
    studentAnswer?: string | null;
    correctAnswer?: string | null;
    answerText?: string | null;
    explanation?: string | null;
  }>;
}

export interface GradingItem {
  submissionId: number;
  examId: number;
  examTitle: string;
  totalPoints: number;
  studentId: number;
  submittedAt: string;
  currentScore: number | null;
  essayResponses: SubmissionReview['questions'];
}

export const submissionApi = {
  mine: async (): Promise<Submission[]> => {
    const res = await apiClient.get<ApiResponse<Submission[]>>('/v1/submissions/mine');
    return res.data.data;
  },

  forExam: async (examId: number): Promise<Submission[]> => {
    const res = await apiClient.get<ApiResponse<Submission[]>>(`/v1/submissions/exam/${examId}`);
    return res.data.data;
  },

  proctorSummary: async (id: number): Promise<Record<string, number>> => {
    const res = await apiClient.get<ApiResponse<Record<string, number>>>(`/v1/submissions/${id}/proctor-events`);
    return res.data.data;
  },

  start: async (examId: number, password?: string): Promise<Submission> => {
    const res = await apiClient.post<ApiResponse<Submission>>('/v1/submissions/start', { examId, password });
    return res.data.data;
  },

  saveAnswers: async (submissionId: number, answers: Record<number, string>): Promise<void> => {
    await apiClient.post(`/v1/submissions/${submissionId}/save-answer`, { answers });
  },

  submit: async (submissionId: number, answers: Record<number, string>): Promise<Submission> => {
    const res = await apiClient.post<ApiResponse<Submission>>(
      `/v1/submissions/${submissionId}/submit`,
      { answers }
    );
    return res.data.data;
  },

  get: async (id: number): Promise<Submission> => {
    const res = await apiClient.get<ApiResponse<Submission>>(`/v1/submissions/${id}`);
    return res.data.data;
  },

  review: async (id: number): Promise<SubmissionReview> => {
    const res = await apiClient.get<ApiResponse<SubmissionReview>>(`/v1/submissions/${id}/review`);
    return res.data.data;
  },

  gradingQueue: async (): Promise<GradingItem[]> => {
    const res = await apiClient.get<ApiResponse<GradingItem[]>>('/v1/submissions/grading-queue');
    return res.data.data;
  },

  grade: async (id: number, score: number, feedback: string): Promise<void> => {
    await apiClient.post(`/v1/submissions/${id}/grade`, { score, feedback });
  },

  logProctorEvent: async (submissionId: number, eventType: string): Promise<void> => {
    await apiClient.post(`/v1/submissions/${submissionId}/proctor-event`, {
      eventType: eventType === 'COPY' ? 'COPY_ATTEMPT' : eventType,
      severity: 'MEDIUM',
    });
  },
};