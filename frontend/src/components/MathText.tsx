import 'katex/contrib/mhchem';
import 'katex/dist/katex.min.css';
import katex from 'katex';

interface MathTextProps {
  children: string | null | undefined;
  className?: string;
}

const CHEMISTRY_COMMAND = String.raw`\\ce\{(?:[^{}]|\{[^{}]*\})*\}`;
const MATH_SEGMENT = new RegExp(
  `(\\$\\$[\\s\\S]+?\\$\\$|\\\\\\[[\\s\\S]+?\\\\\\]|\\$[^$\\n]+?\\$|\\\\\\([\\s\\S]+?\\\\\\)|${CHEMISTRY_COMMAND})`,
  'g',
);
const COMPLETE_MATH_SEGMENT = new RegExp(
  `^(?:\\$\\$[\\s\\S]+\\$\\$|\\\\\\[[\\s\\S]+\\\\\\]|\\$[^$\\n]+\\$|\\\\\\([\\s\\S]+\\\\\\)|${CHEMISTRY_COMMAND})$`,
);
const BARE_MATH_ENVIRONMENT = /\\begin\{(array|aligned|alignedat|gathered|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|smallmatrix|split|subarray)\}[\s\S]*?\\end\{\1\}/g;
const CHEMICAL_SYMBOLS = new Set(
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '),
);
const COMMON_FORMULAS_WITHOUT_DIGITS = new Set([
  'CO', 'HCl', 'HF', 'HI', 'KOH', 'NaCl', 'NaOH', 'NO', 'OH',
]);
const BIOLOGICAL_IDENTIFIERS = new Set(['H1N1', 'H3N2', 'H5N1']);
const CHEMICAL_SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const SUBSCRIPT_DIGITS = new Map([...CHEMICAL_SUBSCRIPTS].map((digit, index) => [digit, String(index)]));
const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};
const CHEMICAL_TOKEN = String.raw`[A-Z][a-z]?(?:\d+|[₀-₉]+)?`;
const CHEMICAL_GROUP = String.raw`\((?:${CHEMICAL_TOKEN})+\)(?:\d+|[₀-₉]+)?`;
const RAW_CHEMICAL_FORMULA = new RegExp(
  String.raw`(^|[^A-Za-z0-9])(\d*(?:(?:${CHEMICAL_TOKEN}|${CHEMICAL_GROUP})+)(?:\^[0-9]*[+−-]|[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻]|[+-])?)(?=$|[^A-Za-z0-9])`,
  'g',
);
const BARE_CHEMISTRY_COMMAND = new RegExp(CHEMISTRY_COMMAND, 'g');

function normalizeChemicalFormula(formula: string): string {
  return formula
    .replace(/[₀-₉]/g, (digit) => SUBSCRIPT_DIGITS.get(digit) ?? digit)
    .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/, (_, digits: string, charge: string) => (
      `^${[...digits].map((digit) => SUPERSCRIPT_DIGITS[digit]).join('')}${charge === '⁺' ? '+' : '-'}`
    ))
    .replace(/\^(\d*)−$/, '^$1-');
}

function formatRawChemicalFormula(text: string): string {
  return text.replace(RAW_CHEMICAL_FORMULA, (match, prefix: string, formula: string) => {
    const species = formula.replace(/^\d+/, '');
    const symbols = species.match(/[A-Z][a-z]?/g) ?? [];
    if (symbols.some((symbol) => !CHEMICAL_SYMBOLS.has(symbol))) return match;
    const normalizedFormula = normalizeChemicalFormula(formula)
      .replace(/^(\d*)([A-Z][a-z]?)(\d+)([+-])$/, '$1$2^$3$4');
    const hasSubscript = /\d|[₀-₉]/.test(formula);
    const hasCharge = /[+−⁺⁻-]$/.test(formula) || /\^[0-9]*[+−-]$/.test(formula);
    const hasGroup = formula.includes('(');
    if (!hasSubscript && !hasCharge && !hasGroup
      && !COMMON_FORMULAS_WITHOUT_DIGITS.has(normalizedFormula)) return match;
    if (BIOLOGICAL_IDENTIFIERS.has(normalizedFormula)) return match;
    return `${prefix}$\\ce{${normalizedFormula}}$`;
  });
}

export function decodeHtmlEntities(value: string): string {
  if (typeof document === 'undefined' || !/[&][#A-Za-z]/.test(value)) return value;
  const textarea = document.createElement('textarea');
  let decoded = value;
  for (let i = 0; i < 2; i++) {
    textarea.innerHTML = decoded;
    const next = textarea.value;
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function MathText({ children, className }: MathTextProps) {
  const decodedText = decodeHtmlEntities(children ?? '');
  const text = decodedText.split(MATH_SEGMENT).map((segment) => {
    if (COMPLETE_MATH_SEGMENT.test(segment)) {
      return segment.replace(BARE_CHEMISTRY_COMMAND, (command) => (
        `\\ce{${normalizeChemicalFormula(command.slice(4, -1))}}`
      ));
    }
    return formatRawChemicalFormula(
      segment.replace(BARE_MATH_ENVIRONMENT, (environment) => `$$${environment}$$`),
    );
  }).join('');
  const segments = text.split(MATH_SEGMENT);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (!segment || !COMPLETE_MATH_SEGMENT.test(segment)) {
          return segment;
        }

        const isBareChemistry = segment.startsWith('\\ce{');
        const displayMode = segment.startsWith('$$') || segment.startsWith('\\[');
        const tex = displayMode
          ? segment.slice(2, -2)
          : isBareChemistry ? segment
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
