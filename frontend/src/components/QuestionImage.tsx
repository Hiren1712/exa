import { apiClient } from '../api/client';

interface Props { src?: string | null; alt: string; className?: string; }
export function QuestionImage({ src, alt, className = '' }: Props) {
  if (!src || !/^\/api\/v1\/question-media\/[0-9a-f-]{36}$/.test(src)) return null;
  const base = apiClient.defaults.baseURL || '/api';
  const url = `${base.replace(/\/api\/?$/, '')}${src}`;
  return <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-block max-w-full ${className}`} title="Mở ảnh kích thước đầy đủ">
    <img src={url} alt={alt} loading="lazy" className="max-h-80 w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain dark:border-slate-700" />
  </a>;
}
