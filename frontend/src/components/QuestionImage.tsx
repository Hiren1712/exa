import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { useLanguage } from '../i18n';

interface Props { src?: string | null; alt: string; className?: string; }
export function QuestionImage({ src, alt, className = '' }: Props) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const isValidImageUrl = !!src && /^\/api\/v1\/question-media\/[0-9a-f-]{36}(?:\?ai=1)?$/.test(src);
  const isAiEnhanced = !!src?.endsWith('?ai=1');

  useEffect(() => {
    if (!isValidImageUrl && isOpen) {
      setIsOpen(false);
      return;
    }
    if (!isOpen) {
      setShowOriginal(false);
      return;
    }
    closeButtonRef.current?.focus();
  }, [isOpen, isValidImageUrl]);

  useEffect(() => {
    setShowOriginal(false);
  }, [src]);

  if (!isValidImageUrl || !src) return null;
  const base = apiClient.defaults.baseURL || '/api';
  const url = `${base.replace(/\/api\/?$/, '')}${src}`;
  const originalUrl = isAiEnhanced ? url.replace('?ai=1', '?original=true') : url;
  const displayUrl = isAiEnhanced && showOriginal ? originalUrl : url;
  const closeViewer = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return <>
    <button
      ref={triggerRef}
      type="button"
      onClick={() => {
        setShowOriginal(false);
        setIsOpen(true);
      }}
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
          if (isAiEnhanced && document.activeElement === closeButtonRef.current) {
            toggleButtonRef.current?.focus();
          } else {
            closeButtonRef.current?.focus();
          }
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeViewer();
      }}
      className="fixed inset-0 z-[100] flex h-dvh w-screen items-center justify-center overflow-hidden bg-black/80 p-4"
    >
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        {isAiEnhanced && <button
          ref={toggleButtonRef}
          type="button"
          onClick={() => setShowOriginal((value) => !value)}
          className="rounded-full bg-slate-950/70 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950"
        >
          {showOriginal ? t('Xem ảnh AI') : t('Xem ảnh gốc')}
        </button>}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={closeViewer}
          className="rounded-full bg-slate-950/70 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950"
          aria-label={t('Đóng ảnh')}
        >
          {t('Đóng')}
        </button>
      </div>
      {isAiEnhanced && <p className="absolute bottom-4 rounded bg-slate-950/70 px-3 py-2 text-center text-xs text-white">
        {t('Ảnh AI có thể sai lệch chi tiết; hãy đối chiếu với ảnh gốc.')}
      </p>}
      <img src={displayUrl} alt={alt} className="h-auto max-h-[90vh] max-w-[90vw] cursor-zoom-out object-contain" />
    </div>}
  </>;
}
