import type { QuestionType } from '../api/question';

export const TRUE_FALSE_STATEMENTS_COUNT = 4;

export function isFourStatementTrueFalse(type: QuestionType, options?: string[]): boolean {
  return type === 'TRUE_FALSE' && options?.length === TRUE_FALSE_STATEMENTS_COUNT;
}

export function updateTrueFalseAnswer(answer: string, index: number, mark: 'T' | 'F'): string {
  const marks = /^[TF-]{4}$/i.test(answer)
    ? answer.toUpperCase().split('')
    : Array.from({ length: TRUE_FALSE_STATEMENTS_COUNT }, () => '-');
  marks[index] = mark;
  return marks.join('');
}

export function updateTrueFalseKey(answer: string, index: number, mark: 'T' | 'F'): string {
  const marks = /^[TF]{4}$/i.test(answer)
    ? answer.toUpperCase().split('')
    : Array.from({ length: TRUE_FALSE_STATEMENTS_COUNT }, () => 'F');
  marks[index] = mark;
  return marks.join('');
}

export function trueFalseScoreRatio(correctAnswer: string | undefined, studentAnswer: string): number {
  const correct = correctAnswer?.trim().toUpperCase() ?? '';
  const answer = studentAnswer.trim().toUpperCase();
  if (!/^[TF]{4}$/.test(correct) || !/^[TF-]{4}$/.test(answer)) {
    return correct === answer ? 1 : 0;
  }

  const correctCount = correct.split('').filter((mark, index) => answer[index] === mark).length;
  return [0, 0.1, 0.25, 0.5, 1][correctCount];
}

export function hasQuestionAnswer(type: QuestionType, options: string[] | undefined, answer: string | undefined): boolean {
  if (!answer?.trim()) return false;
  return isFourStatementTrueFalse(type, options) ? /[TF]/i.test(answer) : true;
}
