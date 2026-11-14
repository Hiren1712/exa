import { useState } from 'react';
import { Input, Select } from './Input';
import { SUBJECTS } from '../lib/utils';
import { useLanguage } from '../i18n';

interface SubjectInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  showHint?: boolean;
  emptyLabel?: string;
  'aria-label'?: string;
}

export function SubjectInput({
  value,
  onChange,
  label = 'Môn học',
  required = false,
  showHint = true,
  emptyLabel,
  'aria-label': ariaLabel,
}: SubjectInputProps) {
  const { t } = useLanguage();
  const [addingOther, setAddingOther] = useState(false);
  const [otherSubject, setOtherSubject] = useState('');
  const subjectOptions = [
    ...(emptyLabel ? [{ value: '', label: t(emptyLabel) }] : []),
    ...SUBJECTS.map((subject) => ({ value: subject, label: t(subject) })),
    ...(value && !SUBJECTS.includes(value) ? [{ value, label: value }] : []),
  ];

  return (
    <div className="w-full space-y-2">
      {addingOther ? (
        <>
          <Input
            label={t('Môn học khác')}
            aria-label={ariaLabel ? t('Môn học khác') : undefined}
            value={otherSubject}
            onChange={(event) => setOtherSubject(event.target.value)}
            maxLength={60}
            required={required}
            placeholder={t('Nhập tên môn học')}
            helper={showHint ? t('Tên môn học tối đa 60 ký tự.') : undefined}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="text-sm font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300"
              disabled={!otherSubject.trim()}
              onClick={() => {
                onChange(otherSubject.trim());
                setAddingOther(false);
              }}
            >
              {t('Dùng môn này')}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300"
              onClick={() => setAddingOther(false)}
            >
              {t('Hủy')}
            </button>
          </div>
        </>
      ) : (
        <>
          <Select
            label={t(label)}
            aria-label={ariaLabel ? t(ariaLabel) : undefined}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            options={subjectOptions}
            required={required}
          />
          <button
            type="button"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300"
            onClick={() => {
              setOtherSubject(value && !SUBJECTS.includes(value) ? value : '');
              setAddingOther(true);
            }}
          >
            {t('+ Thêm môn khác')}
          </button>
        </>
      )}
    </div>
  );
}
