import { HelpCategoryMeta, HelpItem } from '../types';

export const HELP_CATEGORIES: HelpCategoryMeta[] = [
  { id: 'math', label: 'Math', shortDesc: 'Arithmetic, powers, roots, factorials, word operators' },
  { id: 'ans-vars', label: 'ans & Vars', shortDesc: 'TI-style ans chaining, clicked old answers, custom variables' },
  { id: 'currency', label: 'Currencies', shortDesc: 'ISO codes, symbols, live FX conversions, mixed currency math' },
  { id: 'percent', label: 'Percent', shortDesc: '% of, % off, % on, tax additions, ratio as %' },
  { id: 'units', label: 'Units & Dates', shortDesc: 'Length, weight, temp, data, volume, area, speed, CSS, dates' },
  { id: 'functions', label: 'Trig & Fn', shortDesc: 'sin, cos, tan, log, ln, sqrt, gcd, lcm, nCr, rounding' },
  { id: 'aggregates', label: 'Totals', shortDesc: 'Block sum, total, and average across consecutive rows' },
  { id: 'bitwise', label: 'Bitwise', shortDesc: 'Hex, binary, octal, shifts, AND, OR, XOR, NOT' },
  { id: 'formatting', label: 'Notes & ---', shortDesc: '--- visual divider, # headings, // comments, labels, /help' },
];

export const HELP_ITEMS: HelpItem[] = [
  // ans & Variables
  {
    id: 'ans-chain',
    title: 'Last Output (ans)',
    category: 'ans-vars',
    syntax: 'ans + <expr>',
    exampleInput: 'ans + 4',
    exampleOutput: '7',
    description:
      'Works like a Texas Instruments calculator: "ans" (or "prev") always references the immediately preceding output above the current row.',
    keywords: ['ans', 'prev', 'previous', 'last', 'output', 'ti', 'chain'],
  },
  {
    id: 'click-old-ans',
    title: 'Click Old Answer',
    category: 'ans-vars',
    syntax: 'click result → ans1',
    exampleInput: 'ans1 * 2',
    exampleOutput: '6',
    description:
      'Place your cursor on a row below an older calculation and click its result on the right to bind & insert a persistent row variable (e.g. ans1). Cannot reference rows at or below the cursor.',
    keywords: ['click', 'old', 'answer', 'ans1', 'reference', 'cursor', 'variable'],
  },
  {
    id: 'custom-var',
    title: 'Custom Variable',
    category: 'ans-vars',
    syntax: '<name> = <expr>',
    exampleInput: 'monthly_rent = $1,850',
    exampleOutput: '$1,850',
    description:
      'Define named variables anywhere on a sheet and reuse them on any row below. Updating the variable updates all dependent rows.',
    keywords: ['variable', 'assign', 'equals', '=', 'custom', 'store'],
  },

  // Math Operators
  {
    id: 'basic-arith',
    title: 'Arithmetic & Words',
    category: 'math',
    syntax: '+ - * / · plus, times',
    exampleInput: '(125 + 75) divided by 4',
    exampleOutput: '50',
    description:
      'Combine standard symbols (+, -, *, /, ×, ÷) with natural English operators (plus, and, with, minus, without, times, divided by, over).',
    keywords: ['add', 'subtract', 'multiply', 'divide', 'plus', 'minus', 'times', 'arithmetic'],
  },
  {
    id: 'exponent',
    title: 'Exponents & Powers',
    category: 'math',
    syntax: 'x ^ y · pow(x, y)',
    exampleInput: '2 ^ 10',
    exampleOutput: '1 024',
    description: 'Right-associative exponentiation using ^ or **, plus pow(base, exp).',
    keywords: ['power', 'exponent', '^', '**', 'pow', 'square', 'cube'],
  },
  {
    id: 'factorial-mod',
    title: 'Factorial & Modulo',
    category: 'math',
    syntax: 'n! · a mod b',
    exampleInput: '5! + (17 mod 5)',
    exampleOutput: '122',
    description: 'Compute factorials with ! and remainders with mod (or modulo).',
    keywords: ['factorial', '!', 'mod', 'modulo', 'remainder'],
  },
  {
    id: 'constants',
    title: 'Constants & Implicit ×',
    category: 'math',
    syntax: 'pi · e · tau · phi',
    exampleInput: '2 pi * 5',
    exampleOutput: '31.42',
    description:
      'Built-in constants (π, e, τ, φ) support implicit multiplication like 2 pi or 3(4 + 5).',
    keywords: ['pi', 'e', 'tau', 'phi', 'golden ratio', 'constant', 'implicit'],
  },

  // Currencies
  {
    id: 'curr-convert',
    title: 'Currency Conversion',
    category: 'currency',
    syntax: '<amt> <CUR> in <TO>',
    exampleInput: '$250 in EUR',
    exampleOutput: '€230',
    description:
      'Convert between 35+ world currencies and major crypto (USD, EUR, GBP, SEK, NOK, DKK, CHF, JPY, CAD, AUD, BTC, ETH…) using "in" or "to".',
    keywords: ['currency', 'convert', 'usd', 'eur', 'sek', 'gbp', 'jpy', 'btc', 'money', 'fx', 'exchange'],
  },
  {
    id: 'curr-mixed',
    title: 'Mixed-Currency Math',
    category: 'currency',
    syntax: '$30 + 15 EUR in USD',
    exampleInput: '$30 CAD + 15 USD - 10 EUR in USD',
    exampleOutput: '$35.56',
    description:
      'Add or subtract different currencies directly—results automatically convert into the leading currency or a trailing "in <CUR>" target.',
    keywords: ['mixed', 'currency', 'cad', 'usd', 'eur', 'sum', 'travel', 'symbols'],
  },
  {
    id: 'curr-symbols',
    title: 'Currency Symbols',
    category: 'currency',
    syntax: '$50 · €40 · £25 · 500 kr',
    exampleInput: '€85 + £40 in SEK',
    exampleOutput: '1 415.72 SEK',
    description:
      'Use prefix symbols ($, €, £, ¥, ₹, ₿, CA$, A$, HK$), ISO codes, or spoken names (dollars, euros, krona, yen).',
    keywords: ['dollar', 'euro', 'pound', 'krona', 'kr', 'yen', 'bitcoin', 'symbol'],
  },

  // Percentages
  {
    id: 'pct-of',
    title: 'Percentage of Value',
    category: 'percent',
    syntax: '<P>% of <val>',
    exampleInput: '20% of $350',
    exampleOutput: '$70',
    description: 'Calculates a percentage share while preserving currency or measurement units.',
    keywords: ['percent', '%', 'of', 'share', 'portion', 'commission'],
  },
  {
    id: 'pct-off-add',
    title: 'Discounts & Markups',
    category: 'percent',
    syntax: '<val> - <P>% · <P>% off <val>',
    exampleInput: '$120 - 15%',
    exampleOutput: '$102',
    description:
      'Add or subtract a percentage directly (e.g. $120 + 25% VAT, or 10% off $37.99). Also works with percentage variables like subtotal + tax.',
    keywords: ['discount', 'off', 'markup', 'tax', 'vat', 'tip', 'percent', '%'],
  },
  {
    id: 'pct-ratio',
    title: 'Percentage Ratio',
    category: 'percent',
    syntax: '<a> as a % of <b>',
    exampleInput: '45 as a % of 180',
    exampleOutput: '25%',
    description: 'Expresses one quantity or currency amount as a percentage of another.',
    keywords: ['as a % of', 'is what % of', 'ratio', 'proportion', 'percentage'],
  },

  // Units & Dates
  {
    id: 'unit-length',
    title: 'Length & Imperial',
    category: 'units',
    syntax: '6 ft 2 in cm · km in mi',
    exampleInput: '6 ft 2 in cm',
    exampleOutput: '187.96 cm',
    description:
      'Supports mm, cm, m, km, in/inches, ft/feet, yd, mi, nmi, and compound measurements like 6 ft 2 in.',
    keywords: ['length', 'distance', 'cm', 'km', 'miles', 'feet', 'inches', 'meters', 'imperial'],
  },
  {
    id: 'unit-temp',
    title: 'Temperature',
    category: 'units',
    syntax: '°C in °F · °F to K',
    exampleInput: '72 °F in °C',
    exampleOutput: '22.22 °C',
    description: 'Converts between Celsius (°C), Fahrenheit (°F), and Kelvin (K).',
    keywords: ['temperature', 'celsius', 'fahrenheit', 'kelvin', 'c', 'f', 'k', 'weather'],
  },
  {
    id: 'unit-data',
    title: 'Data & Storage',
    category: 'units',
    syntax: 'B, KB, MB, GB, TB, GiB',
    exampleInput: '2.5 TB in GB',
    exampleOutput: '2 500 GB',
    description: 'Convert between decimal SI (KB, MB, GB, TB) and binary IEC (KiB, MiB, GiB, TiB) units.',
    keywords: ['data', 'bytes', 'bits', 'kb', 'mb', 'gb', 'tb', 'gib', 'storage'],
  },
  {
    id: 'unit-mass-vol',
    title: 'Mass, Volume & CSS',
    category: 'units',
    syntax: 'kg ↔ lb · L ↔ gal · px ↔ rem',
    exampleInput: '24 px in rem',
    exampleOutput: '1.5 rem',
    description:
      'Convert mass (mg, g, kg, oz, lb), volume (mL, L, tsp, tbsp, cup, fl oz, gal), area (m², sq ft, acre, ha), speed (km/h, mph), and CSS (px, pt, rem).',
    keywords: ['weight', 'kg', 'lb', 'ounces', 'liters', 'gallons', 'cups', 'sqft', 'px', 'rem', 'css'],
  },
  {
    id: 'date-math',
    title: 'Date Arithmetic',
    category: 'units',
    syntax: 'today + <N> days / weeks',
    exampleInput: 'today + 2 weeks',
    exampleOutput: 'Nov 27, 2026',
    description: 'Add or subtract time durations (hours, days, weeks, months, years) from today, tomorrow, or now.',
    keywords: ['date', 'time', 'today', 'tomorrow', 'now', 'weeks', 'days', 'hours'],
  },

  // Functions & Trig
  {
    id: 'trig-fns',
    title: 'Trigonometry',
    category: 'functions',
    syntax: 'sin 30° · cos(x) · atan2',
    exampleInput: 'sin 30° + cos 60°',
    exampleOutput: '1',
    description:
      'Supports sin, cos, tan, asin, acos, atan, atan2, sinh, cosh, tanh—callable with or without parentheses. Default angle mode is set on the back of the calculator.',
    keywords: ['sin', 'cos', 'tan', 'trig', 'degrees', 'radians', 'angle', 'asin', 'acos', 'atan'],
  },
  {
    id: 'roots-logs',
    title: 'Roots & Logarithms',
    category: 'functions',
    syntax: 'sqrt x · √x · ln(x) · log(x, b)',
    exampleInput: 'sqrt 144 + log(64, 2)',
    exampleOutput: '18',
    description:
      'Square root (sqrt or √), cube root (cbrt), nth root(x, n), natural log (ln), base-10 log(x), log2(x), and arbitrary-base log(x, b).',
    keywords: ['sqrt', 'root', 'cbrt', 'ln', 'log', 'log2', 'log10', 'exponential'],
  },
  {
    id: 'combinatorics',
    title: 'Number Theory & Round',
    category: 'functions',
    syntax: 'gcd · lcm · nCr · round(x, d)',
    exampleInput: 'nCr(10, 3) + gcd(48, 18)',
    exampleOutput: '126',
    description:
      'Includes gcd, lcm, nCr / choose, nPr, min, max, clamp, abs, round(x, decimals), floor, ceil, and trunc.',
    keywords: ['gcd', 'lcm', 'ncr', 'choose', 'npr', 'min', 'max', 'round', 'floor', 'ceil', 'abs'],
  },

  // Aggregates
  {
    id: 'agg-sum',
    title: 'Block Total',
    category: 'aggregates',
    syntax: 'sum · total',
    exampleInput: 'sum',
    exampleOutput: '$960',
    description:
      'Sums all consecutive results above it up to the nearest empty line or # Heading—automatically converting mixed currencies or compatible units.',
    keywords: ['sum', 'total', 'add all', 'block', 'subtotal'],
  },
  {
    id: 'agg-avg',
    title: 'Block Average',
    category: 'aggregates',
    syntax: 'avg · average',
    exampleInput: 'average',
    exampleOutput: '$320',
    description: 'Computes the arithmetic average of consecutive calculated rows in the current block.',
    keywords: ['avg', 'average', 'mean', 'block'],
  },

  // Bitwise & Bases
  {
    id: 'bases-conv',
    title: 'Hex, Binary & Octal',
    category: 'bitwise',
    syntax: '0xFF · 0b1010 · <n> in hex',
    exampleInput: '255 in hex',
    exampleOutput: '0xFF',
    description:
      'Write literals in hex (0x), binary (0b), or octal (0o), and convert any integer using "in hex", "in bin", "in oct", or "in dec".',
    keywords: ['hex', 'hexadecimal', 'binary', 'bin', 'octal', 'oct', '0x', '0b', 'programmer'],
  },
  {
    id: 'bitwise-ops',
    title: 'Bitwise & Shifts',
    category: 'bitwise',
    syntax: '& · | · xor · ~ · << · >>',
    exampleInput: '(0b1100 & 0b1010) in bin',
    exampleOutput: '0b1000',
    description: 'Full integer bitwise operations and bit shifts.',
    keywords: ['bitwise', 'and', 'or', 'xor', 'not', 'shift', '<<', '>>', '&', '|'],
  },

  // Separators & Formatting
  {
    id: 'visual-sep',
    title: 'Visual Separator',
    category: 'formatting',
    syntax: '---',
    exampleInput: '---',
    exampleOutput: '──────',
    description:
      'Typing "---" on a line creates a clean horizontal divider with purely visual function—it never resets "ans" or interferes with calculations.',
    keywords: ['---', 'separator', 'divider', 'line', 'horizontal rule', 'visual'],
  },
  {
    id: 'headings-comments',
    title: 'Headings & Comments',
    category: 'formatting',
    syntax: '# Title · Label: $50 · // note',
    exampleInput: 'Hotel (3 nights): 3 * $180 // refundable',
    exampleOutput: '$540',
    description:
      'Start line 1 with "# Heading" or "Label: " to auto-name the tab, organize sections with "# Heading", and add "// comments" inline or on full lines.',
    keywords: ['heading', '#', 'comment', '//', 'label', 'note', 'text'],
  },
  {
    id: 'slash-char',
    title: 'Open Symbol Picker',
    category: 'formatting',
    syntax: '/char',
    exampleInput: '/char',
    exampleOutput: 'Opens symbol search',
    description:
      'Type "/char" anywhere on a line (or click "/char" in the bottom-left bar) to search and insert special math characters like °, √, ∛, π, ², ³, ‰, or €.',
    keywords: ['/char', 'char', 'symbol', 'degree', 'special', 'characters', 'operators', 'more'],
  },
  {
    id: 'slash-help',
    title: 'Open Help Command',
    category: 'formatting',
    syntax: '/help',
    exampleInput: '/help',
    exampleOutput: 'Opens reference',
    description:
      'Type "/help" on any line or click "/help" in the top bar to search and filter operations.',
    keywords: ['/help', 'help', 'command', 'search', 'documentation'],
  },
];
