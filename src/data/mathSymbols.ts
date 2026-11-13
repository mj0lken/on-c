export interface MathSymbolItem {
  id: string;
  glyph: string;
  insert: string;
  name: string;
  example: string;
  keywords: string[];
}

export const MAX_INLINE_SYMBOLS = 5;

/**
 * Hard-to-type mathematical characters, operators, constants, units, and currencies.
 * The first 5 appear directly in the bottom-left toolbar; the full list is searchable via "More".
 */
export const MATH_SYMBOLS: MathSymbolItem[] = [
  // Top 5 inline quick-insert buttons
  {
    id: 'deg',
    glyph: '°',
    insert: '°',
    name: 'Degrees',
    example: 'sin 30°',
    keywords: ['degree', 'degrees', 'angle', 'deg', 'trig', 'circle'],
  },
  {
    id: 'sqrt',
    glyph: '√',
    insert: '√',
    name: 'Square root',
    example: '√144',
    keywords: ['sqrt', 'root', 'radical', 'square root'],
  },
  {
    id: 'pi',
    glyph: 'π',
    insert: 'π',
    name: 'Pi',
    example: '2π * 5',
    keywords: ['pi', '3.14', 'circle', 'constant', 'greek'],
  },
  {
    id: 'pow',
    glyph: '^',
    insert: '^',
    name: 'Exponent',
    example: '2^10',
    keywords: ['power', 'exponent', 'caret', 'hat', 'superscript'],
  },
  {
    id: 'sq',
    glyph: '²',
    insert: '²',
    name: 'Squared',
    example: '12²',
    keywords: ['squared', 'square', 'power 2', '^2', 'superscript 2', 'm²'],
  },

  // Additional hard-to-type symbols available via "More" searchable list
  {
    id: 'cube',
    glyph: '³',
    insert: '³',
    name: 'Cubed',
    example: '4³',
    keywords: ['cubed', 'cube', 'power 3', '^3', 'superscript 3'],
  },
  {
    id: 'cbrt',
    glyph: '∛',
    insert: '∛',
    name: 'Cube root',
    example: '∛27',
    keywords: ['cbrt', 'cube root', 'third root', 'radical'],
  },
  {
    id: 'celsius',
    glyph: '°C',
    insert: '°C',
    name: 'Celsius',
    example: '22°C in °F',
    keywords: ['celsius', 'centigrade', 'temperature', 'temp', 'c'],
  },
  {
    id: 'fahrenheit',
    glyph: '°F',
    insert: '°F',
    name: 'Fahrenheit',
    example: '72°F in °C',
    keywords: ['fahrenheit', 'temperature', 'temp', 'f'],
  },
  {
    id: 'tau',
    glyph: 'τ',
    insert: 'τ',
    name: 'Tau (2π)',
    example: 'τ / 4',
    keywords: ['tau', '2pi', '6.28', 'constant', 'greek'],
  },
  {
    id: 'phi',
    glyph: 'φ',
    insert: 'φ',
    name: 'Golden ratio',
    example: 'φ²',
    keywords: ['phi', 'golden ratio', '1.618', 'constant', 'greek'],
  },
  {
    id: 'mul',
    glyph: '×',
    insert: '×',
    name: 'Multiply',
    example: '275×85',
    keywords: ['multiply', 'times', 'cross', 'product', '*'],
  },
  {
    id: 'div',
    glyph: '÷',
    insert: '÷',
    name: 'Divide',
    example: '144 ÷ 12',
    keywords: ['divide', 'division', 'obelus', 'over', '/'],
  },
  {
    id: 'permille',
    glyph: '‰',
    insert: '‰',
    name: 'Permille (‰)',
    example: '25‰ of 1000',
    keywords: ['permille', 'per thousand', 'promille', 'basis', '0.1%'],
  },
  {
    id: 'fact',
    glyph: '!',
    insert: '!',
    name: 'Factorial',
    example: '5!',
    keywords: ['factorial', 'bang', 'permute'],
  },
  {
    id: 'xor',
    glyph: '⊕',
    insert: '⊕',
    name: 'Bitwise XOR',
    example: '0b1100 ⊕ 0b1010',
    keywords: ['xor', 'exclusive or', 'bitwise', 'logic'],
  },
  {
    id: 'bnot',
    glyph: '~',
    insert: '~',
    name: 'Bitwise NOT',
    example: '~0',
    keywords: ['tilde', 'not', 'bitwise', 'complement', 'invert'],
  },
  {
    id: 'shl',
    glyph: '<<',
    insert: '<<',
    name: 'Shift left',
    example: '1 << 8',
    keywords: ['shift', 'left shift', 'bitwise', '<<'],
  },
  {
    id: 'shr',
    glyph: '>>',
    insert: '>>',
    name: 'Shift right',
    example: '256 >> 2',
    keywords: ['shift', 'right shift', 'bitwise', '>>'],
  },
  {
    id: 'eur',
    glyph: '€',
    insert: '€',
    name: 'Euro',
    example: '€85 in SEK',
    keywords: ['euro', 'eur', 'currency', 'money'],
  },
  {
    id: 'gbp',
    glyph: '£',
    insert: '£',
    name: 'British Pound',
    example: '£40 in USD',
    keywords: ['pound', 'gbp', 'sterling', 'uk', 'currency'],
  },
  {
    id: 'jpy',
    glyph: '¥',
    insert: '¥',
    name: 'Yen / Yuan',
    example: '¥5000 in EUR',
    keywords: ['yen', 'yuan', 'jpy', 'cny', 'currency'],
  },
  {
    id: 'btc',
    glyph: '₿',
    insert: '₿',
    name: 'Bitcoin',
    example: '₿0.25 in USD',
    keywords: ['bitcoin', 'btc', 'crypto', 'currency'],
  },
  {
    id: 'inr',
    glyph: '₹',
    insert: '₹',
    name: 'Indian Rupee',
    example: '₹2500 in USD',
    keywords: ['rupee', 'inr', 'india', 'currency'],
  },
];
