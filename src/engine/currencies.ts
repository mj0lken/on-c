export interface CurrencyInfo {
  code: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix' | 'code';
  name: string;
  decimals: number;
  /** Default fallback units per 1 USD */
  fallbackPerUsd: number;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$', symbolPosition: 'prefix', name: 'US Dollar', decimals: 2, fallbackPerUsd: 1 },
  EUR: { code: 'EUR', symbol: '€', symbolPosition: 'prefix', name: 'Euro', decimals: 2, fallbackPerUsd: 0.92 },
  GBP: { code: 'GBP', symbol: '£', symbolPosition: 'prefix', name: 'British Pound', decimals: 2, fallbackPerUsd: 0.79 },
  SEK: { code: 'SEK', symbol: 'kr', symbolPosition: 'code', name: 'Swedish Krona', decimals: 2, fallbackPerUsd: 10.65 },
  NOK: { code: 'NOK', symbol: 'kr', symbolPosition: 'code', name: 'Norwegian Krone', decimals: 2, fallbackPerUsd: 10.95 },
  DKK: { code: 'DKK', symbol: 'kr', symbolPosition: 'code', name: 'Danish Krone', decimals: 2, fallbackPerUsd: 6.86 },
  CHF: { code: 'CHF', symbol: 'CHF', symbolPosition: 'code', name: 'Swiss Franc', decimals: 2, fallbackPerUsd: 0.88 },
  JPY: { code: 'JPY', symbol: '¥', symbolPosition: 'prefix', name: 'Japanese Yen', decimals: 0, fallbackPerUsd: 152.4 },
  CAD: { code: 'CAD', symbol: 'CA$', symbolPosition: 'prefix', name: 'Canadian Dollar', decimals: 2, fallbackPerUsd: 1.39 },
  AUD: { code: 'AUD', symbol: 'A$', symbolPosition: 'prefix', name: 'Australian Dollar', decimals: 2, fallbackPerUsd: 1.53 },
  NZD: { code: 'NZD', symbol: 'NZ$', symbolPosition: 'prefix', name: 'New Zealand Dollar', decimals: 2, fallbackPerUsd: 1.68 },
  CNY: { code: 'CNY', symbol: 'CN¥', symbolPosition: 'prefix', name: 'Chinese Yuan', decimals: 2, fallbackPerUsd: 7.23 },
  HKD: { code: 'HKD', symbol: 'HK$', symbolPosition: 'prefix', name: 'Hong Kong Dollar', decimals: 2, fallbackPerUsd: 7.78 },
  SGD: { code: 'SGD', symbol: 'S$', symbolPosition: 'prefix', name: 'Singapore Dollar', decimals: 2, fallbackPerUsd: 1.34 },
  INR: { code: 'INR', symbol: '₹', symbolPosition: 'prefix', name: 'Indian Rupee', decimals: 2, fallbackPerUsd: 84.4 },
  KRW: { code: 'KRW', symbol: '₩', symbolPosition: 'prefix', name: 'South Korean Won', decimals: 0, fallbackPerUsd: 1395 },
  BRL: { code: 'BRL', symbol: 'R$', symbolPosition: 'prefix', name: 'Brazilian Real', decimals: 2, fallbackPerUsd: 5.75 },
  MXN: { code: 'MXN', symbol: 'MX$', symbolPosition: 'prefix', name: 'Mexican Peso', decimals: 2, fallbackPerUsd: 20.1 },
  ZAR: { code: 'ZAR', symbol: 'R', symbolPosition: 'code', name: 'South African Rand', decimals: 2, fallbackPerUsd: 18.1 },
  PLN: { code: 'PLN', symbol: 'zł', symbolPosition: 'suffix', name: 'Polish Zloty', decimals: 2, fallbackPerUsd: 4.02 },
  CZK: { code: 'CZK', symbol: 'Kč', symbolPosition: 'suffix', name: 'Czech Koruna', decimals: 2, fallbackPerUsd: 23.3 },
  HUF: { code: 'HUF', symbol: 'Ft', symbolPosition: 'code', name: 'Hungarian Forint', decimals: 0, fallbackPerUsd: 376 },
  TRY: { code: 'TRY', symbol: '₺', symbolPosition: 'prefix', name: 'Turkish Lira', decimals: 2, fallbackPerUsd: 34.4 },
  ILS: { code: 'ILS', symbol: '₪', symbolPosition: 'prefix', name: 'Israeli Shekel', decimals: 2, fallbackPerUsd: 3.74 },
  AED: { code: 'AED', symbol: 'AED', symbolPosition: 'code', name: 'UAE Dirham', decimals: 2, fallbackPerUsd: 3.6725 },
  SAR: { code: 'SAR', symbol: 'SAR', symbolPosition: 'code', name: 'Saudi Riyal', decimals: 2, fallbackPerUsd: 3.75 },
  THB: { code: 'THB', symbol: '฿', symbolPosition: 'prefix', name: 'Thai Baht', decimals: 2, fallbackPerUsd: 34.6 },
  TWD: { code: 'TWD', symbol: 'NT$', symbolPosition: 'prefix', name: 'Taiwan Dollar', decimals: 2, fallbackPerUsd: 32.4 },
  PHP: { code: 'PHP', symbol: '₱', symbolPosition: 'prefix', name: 'Philippine Peso', decimals: 2, fallbackPerUsd: 58.6 },
  IDR: { code: 'IDR', symbol: 'Rp', symbolPosition: 'prefix', name: 'Indonesian Rupiah', decimals: 0, fallbackPerUsd: 15800 },
  MYR: { code: 'MYR', symbol: 'RM', symbolPosition: 'prefix', name: 'Malaysian Ringgit', decimals: 2, fallbackPerUsd: 4.45 },
  ISK: { code: 'ISK', symbol: 'ISK', symbolPosition: 'code', name: 'Icelandic Krona', decimals: 0, fallbackPerUsd: 138 },
  BTC: { code: 'BTC', symbol: '₿', symbolPosition: 'prefix', name: 'Bitcoin', decimals: 6, fallbackPerUsd: 1 / 88000 },
  ETH: { code: 'ETH', symbol: 'Ξ', symbolPosition: 'prefix', name: 'Ethereum', decimals: 5, fallbackPerUsd: 1 / 3100 },
  SOL: { code: 'SOL', symbol: 'SOL', symbolPosition: 'code', name: 'Solana', decimals: 4, fallbackPerUsd: 1 / 210 },
};

const WORD_ALIASES: Record<string, string> = {
  dollar: 'USD',
  dollars: 'USD',
  usd: 'USD',
  buck: 'USD',
  bucks: 'USD',
  euro: 'EUR',
  euros: 'EUR',
  eur: 'EUR',
  gbp: 'GBP',
  sterling: 'GBP',
  quid: 'GBP',
  sek: 'SEK',
  krona: 'SEK',
  kronor: 'SEK',
  nok: 'NOK',
  dkk: 'DKK',
  chf: 'CHF',
  franc: 'CHF',
  francs: 'CHF',
  jpy: 'JPY',
  yen: 'JPY',
  cad: 'CAD',
  aud: 'AUD',
  nzd: 'NZD',
  cny: 'CNY',
  rmb: 'CNY',
  yuan: 'CNY',
  hkd: 'HKD',
  sgd: 'SGD',
  inr: 'INR',
  rupee: 'INR',
  rupees: 'INR',
  krw: 'KRW',
  won: 'KRW',
  brl: 'BRL',
  reais: 'BRL',
  mxn: 'MXN',
  peso: 'MXN',
  pesos: 'MXN',
  zar: 'ZAR',
  pln: 'PLN',
  zloty: 'PLN',
  czk: 'CZK',
  huf: 'HUF',
  try: 'TRY',
  lira: 'TRY',
  ils: 'ILS',
  shekel: 'ILS',
  shekels: 'ILS',
  aed: 'AED',
  dirham: 'AED',
  dirhams: 'AED',
  sar: 'SAR',
  thb: 'THB',
  baht: 'THB',
  twd: 'TWD',
  php: 'PHP',
  idr: 'IDR',
  myr: 'MYR',
  isk: 'ISK',
  btc: 'BTC',
  bitcoin: 'BTC',
  bitcoins: 'BTC',
  eth: 'ETH',
  ether: 'ETH',
  ethereum: 'ETH',
  sol: 'SOL',
  solana: 'SOL',
};

export const SYMBOL_TO_CURRENCY: Record<string, string> = {
  'CA$': 'CAD',
  'A$': 'AUD',
  'NZ$': 'NZD',
  'HK$': 'HKD',
  'NT$': 'TWD',
  'MX$': 'MXN',
  'CN¥': 'CNY',
  'R$': 'BRL',
  'S$': 'SGD',
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  '₩': 'KRW',
  '₺': 'TRY',
  '₪': 'ILS',
  '฿': 'THB',
  '₱': 'PHP',
  '₿': 'BTC',
  'Ξ': 'ETH',
  zł: 'PLN',
  Kč: 'CZK',
};

export function resolveCurrency(token: string, defaultCurrency = 'USD'): string | null {
  if (SYMBOL_TO_CURRENCY[token]) {
    if (token === '$' && ['CAD', 'AUD', 'NZD', 'HKD', 'SGD', 'MXN', 'TWD'].includes(defaultCurrency)) {
      return defaultCurrency;
    }
    return SYMBOL_TO_CURRENCY[token];
  }
  const upper = token.toUpperCase();
  if (CURRENCIES[upper]) return upper;
  const lower = token.toLowerCase();
  if (lower === 'kr') {
    if (['SEK', 'NOK', 'DKK', 'ISK'].includes(defaultCurrency)) {
      return defaultCurrency;
    }
    return 'SEK';
  }
  return WORD_ALIASES[lower] ?? null;
}

export interface ExchangeRatesState {
  rates: Record<string, number>;
  updatedAt: string | null;
  source: 'live' | 'cached' | 'offline';
}

const FX_STORAGE_KEY = 'onc-fx-rates-v1';

export function getInitialRates(): ExchangeRatesState {
  const base: Record<string, number> = {};
  for (const [code, info] of Object.entries(CURRENCIES)) {
    base[code] = info.fallbackPerUsd;
  }
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(FX_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as { rates: Record<string, number>; updatedAt: string };
      if (parsed && parsed.rates && typeof parsed.rates.EUR === 'number') {
        return {
          rates: { ...base, ...parsed.rates },
          updatedAt: parsed.updatedAt,
          source: 'cached',
        };
      }
    }
  } catch {
    // Ignore storage errors
  }
  return { rates: base, updatedAt: null, source: 'offline' };
}

export async function fetchLiveExchangeRates(): Promise<ExchangeRatesState | null> {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) return null;
    const data = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    if (!data.rates || typeof data.rates.EUR !== 'number') return null;

    const merged: Record<string, number> = {};
    for (const [code, info] of Object.entries(CURRENCIES)) {
      merged[code] = data.rates[code] ?? info.fallbackPerUsd;
    }
    const updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(FX_STORAGE_KEY, JSON.stringify({ rates: merged, updatedAt }));
    } catch {
      // Ignore storage quota errors
    }
    return {
      rates: merged,
      updatedAt,
      source: 'live',
    };
  } catch {
    return null;
  }
}

export function convertCurrency(
  amount: number,
  fromCode: string,
  toCode: string,
  rates: Record<string, number>
): number {
  const from = fromCode.toUpperCase();
  const to = toCode.toUpperCase();
  if (from === to) return amount;
  const fromRate = rates[from] ?? CURRENCIES[from]?.fallbackPerUsd ?? 1;
  const toRate = rates[to] ?? CURRENCIES[to]?.fallbackPerUsd ?? 1;
  const inUsd = amount / fromRate;
  return inUsd * toRate;
}
