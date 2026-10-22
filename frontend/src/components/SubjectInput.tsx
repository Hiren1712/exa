import { useId } from 'react';
import { Input } from './Input';
import { SUBJECTS } from '../lib/utils';

interface SubjectInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  showHint?: boolean;
  'aria-label'?: string;
}

export function SubjectInput({
  value,
  onChange,
  label = 'Môn học',
  required = false,
  showHint = true,
  'aria-label': ariaLabel,
}: SubjectInputProps) {
  const id = useId();

  return (
    <>
      <Input
        label={label}
        aria-label={ariaLabel}
        list={`${id}-subjects`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={60}
        required={required}
        placeholder="Chọn hoặc nhập tên môn học"
        helper={showHint ? 'Có thể chọn gợi ý hoặc tự nhập môn học (tối đa 60 ký tự).' : undefined}
      />
      <datalist id={`${id}-subjects`}>
        {SUBJECTS.map((subject) => <option key={subject} value={subject} />)}
      </datalist>
    </>
  );
}
