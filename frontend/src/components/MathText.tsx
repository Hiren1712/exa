import 'katex/contrib/mhchem';
import 'katex/dist/katex.min.css';
import katex from 'katex';

interface MathTextProps {
  children: string | null | undefined;
  className?: string;
}

const MATH_SEGMENT = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;

export function MathText({ children, className }: MathTextProps) {
  const text = children ?? '';
  const segments = text.split(MATH_SEGMENT);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (!segment || !/^(?:\$\$[\s\S]+\$\$|\\\[[\s\S]+\\\]|\$[^$\n]+\$|\\\([\s\S]+\\\))$/.test(segment)) {
          return segment;
        }

        const displayMode = segment.startsWith('$$') || segment.startsWith('\\[');
        const tex = displayMode
          ? segment.slice(2, -2)
          : segment.startsWith('$') ? segment.slice(1, -1) : segment.slice(2, -2);

        return (
          <span
            key={`${index}-${segment}`}
            className={displayMode ? 'my-2 block overflow-x-auto' : 'inline-block max-w-full align-middle'}
            aria-label={tex}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(tex, {
                displayMode,
                output: 'htmlAndMathml',
                strict: 'ignore',
                throwOnError: false,
                trust: false,
              }),
            }}
          />
        );
      })}
    </span>
  );
}
