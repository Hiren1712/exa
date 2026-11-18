import { MathText } from './MathText';

export function LatexText({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return null;
  return <MathText className={className}>{text}</MathText>;
}
