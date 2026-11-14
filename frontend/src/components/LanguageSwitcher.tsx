import { useLanguage } from '../i18n';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t('Ngôn ngữ giao diện')}
      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 p-1 dark:border-slate-700 dark:bg-slate-900/80"
    >
      {(['vi', 'en'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLanguage(option)}
          aria-pressed={language === option}
          className={`min-h-8 min-w-10 rounded-lg px-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
            language === option
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
