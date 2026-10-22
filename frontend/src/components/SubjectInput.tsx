import { useState } from 'react';
import { Input, Select } from './Input';
import { SUBJECTS } from '../lib/utils';

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
  const [addingOther, setAddingOther] = useState(false);
  const [otherSubject, setOtherSubject] = useState('');
  const subjectOptions = [
    ...(emptyLabel ? [{ value: '', label: emptyLabel }] : []),
    ...SUBJECTS.map((subject) => ({ value: subject, label: subject })),
    ...(value && !SUBJECTS.includes(value) ? [{ value, label: value }] : []),
  ];

  return (
    <div className="w-full space-y-2">
      {addingOther ? (
        <>
          <Input
            label={`${label} khác`}
            aria-label={ariaLabel ? `${ariaLabel} khác` : undefined}
            value={otherSubject}
            onChange={(event) => setOtherSubject(event.target.value)}
            maxLength={60}
            required={required}
            placeholder="Nhập tên môn học"
            helper={showHint ? 'Tên môn học tối đa 60 ký tự.' : undefined}
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
              Dùng môn này
            </button>
            <button
              type="button"
              className="text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300"
              onClick={() => setAddingOther(false)}
            >
              Hủy
            </button>
          </div>
        </>
      ) : (
        <>
          <Select
            label={label}
            aria-label={ariaLabel}
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
            + Thêm môn khác
          </button>
        </>
      )}
    </div>
  );
}
