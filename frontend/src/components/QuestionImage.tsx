import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { useLanguage } from '../i18n';

interface Props { src?: string | null; alt: string; className?: string; }
export function QuestionImage({ src, alt, className = '' }: Props) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isValidImageUrl = !!src && /^\/api\/v1\/question-media\/[0-9a-f-]{36}$/.test(src);

  useEffect(() => {
    if (!isValidImageUrl && isOpen) {
      setIsOpen(false);
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen, isValidImageUrl]);

  if (!isValidImageUrl || !src) return null;
  const base = apiClient.defaults.baseURL || '/api';
  const url = `${base.replace(/\/api\/?$/, '')}${src}`;

  return <>
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className={`inline-block max-w-full cursor-zoom-in border-0 bg-transparent p-0 ${className}`}
      title={t('Mở ảnh kích thước đầy đủ')}
      aria-label={`${t('Mở ảnh kích thước đầy đủ')}: ${alt}`}
    >
      <img src={url} alt={alt} loading="lazy" className="max-h-80 w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain dark:border-slate-700" />
    </button>
    <dialog
      ref={dialogRef}
      aria-label={alt}
      onClose={() => setIsOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) setIsOpen(false);
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 backdrop:bg-black/80"
    >
      <div className="relative flex h-full w-full items-center justify-center p-4">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 z-10 rounded-full bg-slate-950/70 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950"
          aria-label={t('Đóng ảnh')}
        >
          {t('Đóng')}
        </button>
        <img src={url} alt={alt} className="h-auto w-[90vw] max-h-[90vh] max-w-[1200px] cursor-zoom-out object-contain" />
      </div>
    </dialog>
  </>;
}
