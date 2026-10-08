import { clsx, type ClassValue } from 'clsx';

// Merge class names
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Format time (seconds → mm:ss)
export function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Format date
export function fmtDate(date: string | Date | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Format datetime
export function fmtDateTime(date: string | Date | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Truncate string
export function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

// Debounce
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms = 300,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// LocalStorage helpers
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  },
  remove(key: string): void {
    localStorage.removeItem(key);
  },
  clear(): void {
    localStorage.clear();
  },
};

// Difficulty labels
export const DIFFICULTY_LABELS: Record<string, string> = {
  RECOGNITION: 'Nhận biết',
  COMPREHENSION: 'Thông hiểu',
  APPLICATION: 'Vận dụng',
  HIGH_APPLICATION: 'Vận dụng cao',
};

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  MCQ: 'Trắc nghiệm',
  TRUE_FALSE: 'Đúng/Sai',
  SHORT_ANSWER: 'Trả lời ngắn',
  ESSAY: 'Tự luận',
};

export const SUBJECTS = [
  'Toán', 'Vật Lý', 'Hoá Học', 'Tiếng Anh',
  'Ngữ Văn', 'Sinh Học', 'Lịch Sử', 'Địa Lý',
];

export const EXAM_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  SCHEDULED: 'Đã lên lịch',
  OPEN: 'Đang mở',
  CLOSED: 'Đã đóng',
  ARCHIVED: 'Đã lưu trữ',
};