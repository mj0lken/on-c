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
  if (CURRENCIES[upper]) {
    // Auto-registered ISO codes (e.g. ALL, TOP, CUP) collide with words, so require exact uppercase.
    if (DYNAMIC_CODES.has(upper) && token !== upper) return null;
    return upper;
  }
  const lower = token.toLowerCase();
  if (lower === 'kr') {
    if (['SEK', 'NOK', 'DKK', 'ISK'].includes(defaultCurrency)) {
      return defaultCurrency;
    }
    return 'SEK';
  }
  return WORD_ALIASES[lower] ?? null;
}

/** ISO codes added at runtime from the FX feed (not in the curated CURRENCIES table). */
const DYNAMIC_CODES = new Set<string>();

/** Adds every ISO code returned by the FX feed so all currencies are usable. */
export function registerCurrencies(codes: Iterable<string>): void {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(['en'], { type: 'currency' });
  } catch {
    names = null;
  }
  for (const code of codes) {
    if (!/^[A-Z]{3}$/.test(code) || CURRENCIES[code]) continue;
    let symbol = code;
    let decimals = 2;
    try {
      const nf = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' });
      const part = nf.formatToParts(1).find((p) => p.type === 'currency')?.value;
      if (part && !/^[A-Z]{3}$/.test(part) && !SYMBOL_TO_CURRENCY[part]) symbol = part;
      decimals = nf.resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      // Unknown to Intl: keep code as symbol
    }
    const name = names?.of(code);
    CURRENCIES[code] = {
      code,
      symbol,
      symbolPosition: symbol === code ? 'code' : 'prefix',
      name: name && name !== code ? name : code,
      decimals,
      fallbackPerUsd: 1,
    };
    DYNAMIC_CODES.add(code);
  }
}

export interface ExchangeRatesState {
  rates: Record<string, number>;
  updatedAt: string | null;
  source: 'live' | 'cached' | 'offline';
  /** When the provider publishes its next daily update (+1h buffer). */
  nextUpdateAt?: string | null;
}

const FX_STORAGE_KEY = 'onc-fx-rates-v2';
const FIAT_URL = 'https://open.er-api.com/v6/latest/USD';
const CRYPTO_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=USD';
const CRYPTO_CODES = ['BTC', 'ETH', 'SOL'];
/** Never hit the providers more than once per 12h. */
export const FX_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export function getInitialRates(): ExchangeRatesState {
  const base: Record<string, number> = {};
  for (const [code, info] of Object.entries(CURRENCIES)) {
    base[code] = info.fallbackPerUsd;
  }
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(FX_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as {
        rates: Record<string, number>;
        updatedAt: string;
        nextUpdateAt?: string | null;
      };
      if (parsed && parsed.rates && typeof parsed.rates.EUR === 'number') {
        registerCurrencies(Object.keys(parsed.rates));
        return {
          rates: { ...base, ...parsed.rates },
          updatedAt: parsed.updatedAt,
          nextUpdateAt: parsed.nextUpdateAt ?? null,
          source: 'cached',
        };
      }
    }
  } catch {
    // Ignore storage errors
  }
  return { rates: base, updatedAt: null, nextUpdateAt: null, source: 'offline' };
}

/** True if we fetched less than 12h ago (manual sync is then answered from cache). */
export function isWithinMinInterval(state: ExchangeRatesState, now = Date.now()): boolean {
  if (!state.updatedAt) return false;
  return now - new Date(state.updatedAt).getTime() < FX_MIN_INTERVAL_MS;
}

/**
 * Auto-sync rule: once a day, the hour after the provider's daily publish
 * (open.er-api.com publishes ~00:00–00:20 UTC and tells us `time_next_update_utc`),
 * and never more often than every 12h.
 */
export function isAutoSyncDue(state: ExchangeRatesState, now = Date.now()): boolean {
  if (!state.updatedAt) return true;
  if (isWithinMinInterval(state, now)) return false;
  const next = state.nextUpdateAt
    ? new Date(state.nextUpdateAt).getTime()
    : new Date(state.updatedAt).getTime() + ONE_DAY_MS;
  return now >= next;
}

async function fetchCryptoRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch(CRYPTO_URL);
    if (!res.ok) return {};
    const data = (await res.json()) as { data?: { rates?: Record<string, string> } };
    const out: Record<string, number> = {};
    for (const code of CRYPTO_CODES) {
      const v = Number(data.data?.rates?.[code]);
      if (Number.isFinite(v) && v > 0) out[code] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export async function fetchLiveExchangeRates(): Promise<ExchangeRatesState | null> {
  try {
    const [response, crypto] = await Promise.all([fetch(FIAT_URL), fetchCryptoRates()]);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_next_update_unix?: number;
    };
    if (!data.rates || typeof data.rates.EUR !== 'number') return null;

    registerCurrencies(Object.keys(data.rates));
    const merged: Record<string, number> = {};
    for (const [code, info] of Object.entries(CURRENCIES)) {
      merged[code] = crypto[code] ?? data.rates[code] ?? info.fallbackPerUsd;
    }
    const now = Date.now();
    const updatedAt = new Date(now).toISOString();
    const nextUpdateAt = new Date(
      data.time_next_update_unix ? data.time_next_update_unix * 1000 + ONE_HOUR_MS : now + ONE_DAY_MS
    ).toISOString();
    try {
      localStorage.setItem(FX_STORAGE_KEY, JSON.stringify({ rates: merged, updatedAt, nextUpdateAt }));
    } catch {
      // Ignore storage quota errors
    }
    return { rates: merged, updatedAt, nextUpdateAt, source: 'live' };
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
