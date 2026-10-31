import katex from 'katex';
import React from 'react';

import 'katex/dist/katex.min.css';

const formulaRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;
const completeFormulaRegex = /^(?:\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)$/;

export function LatexText({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return null;

  return (
    <span className={className}>
      {text.split(formulaRegex).map((part, index) => {
        if (!part || !completeFormulaRegex.test(part)) {
          return <React.Fragment key={`${index}-${part}`}>{part}</React.Fragment>;
        }

        const displayMode = (part.startsWith('$$') && part.endsWith('$$'))
          || (part.startsWith('\\[') && part.endsWith('\\]'));
        const normalized = part.startsWith('$$') || part.startsWith('\\[')
          || part.startsWith('\\(')
          ? part.slice(2, -2)
          : part.slice(1, -1);

        if (!normalized.trim()) {
          return <React.Fragment key={`${index}-${part}`}>{part}</React.Fragment>;
        }

        return (
          <span
            key={`${index}-${part}`}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(normalized, {
                displayMode,
                throwOnError: false,
                output: 'htmlAndMathml',
              }),
            }}
          />
        );
      })}
    </span>
  );
}
