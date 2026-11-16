import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { useLanguage } from '../i18n';

interface Props { src?: string | null; alt: string; className?: string; }
export function QuestionImage({ src, alt, className = '' }: Props) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isValidImageUrl = !!src && /^\/api\/v1\/question-media\/[0-9a-f-]{36}$/.test(src);

  useEffect(() => {
    if (!isValidImageUrl && isOpen) {
      setIsOpen(false);
      return;
    }
    if (!isOpen) return;
    closeButtonRef.current?.focus();
  }, [isOpen, isValidImageUrl]);

  if (!isValidImageUrl || !src) return null;
  const base = apiClient.defaults.baseURL || '/api';
  const url = `${base.replace(/\/api\/?$/, '')}${src}`;
  const closeViewer = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return <>
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setIsOpen(true)}
      className={`inline-block max-w-full cursor-zoom-in border-0 bg-transparent p-0 ${className}`}
      title={t('Mở ảnh kích thước đầy đủ')}
      aria-label={`${t('Mở ảnh kích thước đầy đủ')}: ${alt}`}
    >
      <img src={url} alt={alt} loading="lazy" className="max-h-80 w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain dark:border-slate-700" />
    </button>
    {isOpen && <div
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-label={alt}
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeViewer();
        if (event.key === 'Tab') {
          event.preventDefault();
          closeButtonRef.current?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeViewer();
      }}
      className="fixed inset-0 z-[100] flex h-dvh w-screen items-center justify-center overflow-hidden bg-black/80 p-4"
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={closeViewer}
        className="absolute right-4 top-4 z-10 rounded-full bg-slate-950/70 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950"
        aria-label={t('Đóng ảnh')}
      >
        {t('Đóng')}
      </button>
      <img src={url} alt={alt} className="h-auto max-h-[90vh] max-w-[90vw] cursor-zoom-out object-contain" />
    </div>}
  </>;
}
