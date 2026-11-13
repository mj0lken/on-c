export type UnitCategory =
  | 'length'
  | 'mass'
  | 'temperature'
  | 'volume'
  | 'area'
  | 'speed'
  | 'data'
  | 'time'
  | 'angle'
  | 'css';

export interface UnitDef {
  id: string;
  symbol: string;
  category: UnitCategory;
  /** Factor to multiply by to convert to category base unit (except temperature) */
  toBase: number;
  aliases: string[];
}

const UNIT_LIST: UnitDef[] = [
  // Length (base: meter)
  { id: 'mm', symbol: 'mm', category: 'length', toBase: 0.001, aliases: ['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres'] },
  { id: 'cm', symbol: 'cm', category: 'length', toBase: 0.01, aliases: ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres'] },
  { id: 'm', symbol: 'm', category: 'length', toBase: 1, aliases: ['m', 'meter', 'meters', 'metre', 'metres'] },
  { id: 'km', symbol: 'km', category: 'length', toBase: 1000, aliases: ['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres'] },
  { id: 'in', symbol: 'in', category: 'length', toBase: 0.0254, aliases: ['inch', 'inches', '"'] },
  { id: 'ft', symbol: 'ft', category: 'length', toBase: 0.3048, aliases: ['ft', 'foot', 'feet', "'"] },
  { id: 'yd', symbol: 'yd', category: 'length', toBase: 0.9144, aliases: ['yd', 'yds', 'yard', 'yards'] },
  { id: 'mi', symbol: 'mi', category: 'length', toBase: 1609.344, aliases: ['mi', 'mile', 'miles'] },
  { id: 'nmi', symbol: 'nmi', category: 'length', toBase: 1852, aliases: ['nmi', 'nautical mile', 'nautical miles'] },

  // Mass / Weight (base: gram)
  { id: 'mg', symbol: 'mg', category: 'mass', toBase: 0.001, aliases: ['mg', 'milligram', 'milligrams'] },
  { id: 'g', symbol: 'g', category: 'mass', toBase: 1, aliases: ['g', 'gram', 'grams', 'gm'] },
  { id: 'kg', symbol: 'kg', category: 'mass', toBase: 1000, aliases: ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'] },
  { id: 't', symbol: 't', category: 'mass', toBase: 1_000_000, aliases: ['tonne', 'tonnes', 'metric ton', 'metric tons'] },
  { id: 'oz', symbol: 'oz', category: 'mass', toBase: 28.349523125, aliases: ['oz', 'ounce', 'ounces'] },
  { id: 'lb', symbol: 'lb', category: 'mass', toBase: 453.59237, aliases: ['lb', 'lbs', 'pound', 'pounds'] },
  { id: 'st', symbol: 'st', category: 'mass', toBase: 6350.29318, aliases: ['st', 'stone', 'stones'] },

  // Temperature (affine, handled specially)
  { id: 'C', symbol: '°C', category: 'temperature', toBase: 1, aliases: ['c', '°c', 'celsius', 'centigrade'] },
  { id: 'F', symbol: '°F', category: 'temperature', toBase: 1, aliases: ['f', '°f', 'fahrenheit'] },
  { id: 'K', symbol: 'K', category: 'temperature', toBase: 1, aliases: ['k', 'kelvin', 'kelvins'] },

  // Volume (base: liter)
  { id: 'ml', symbol: 'mL', category: 'volume', toBase: 0.001, aliases: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'cc'] },
  { id: 'cl', symbol: 'cL', category: 'volume', toBase: 0.01, aliases: ['cl', 'centiliter', 'centiliters'] },
  { id: 'dl', symbol: 'dL', category: 'volume', toBase: 0.1, aliases: ['dl', 'deciliter', 'deciliters'] },
  { id: 'l', symbol: 'L', category: 'volume', toBase: 1, aliases: ['l', 'liter', 'liters', 'litre', 'litres'] },
  { id: 'tsp', symbol: 'tsp', category: 'volume', toBase: 0.00492892159375, aliases: ['tsp', 'teaspoon', 'teaspoons'] },
  { id: 'tbsp', symbol: 'tbsp', category: 'volume', toBase: 0.01478676478125, aliases: ['tbsp', 'tablespoon', 'tablespoons'] },
  { id: 'floz', symbol: 'fl oz', category: 'volume', toBase: 0.0295735295625, aliases: ['floz', 'fl oz', 'fluid ounce', 'fluid ounces'] },
  { id: 'cup', symbol: 'cup', category: 'volume', toBase: 0.2365882365, aliases: ['cup', 'cups'] },
  { id: 'pint', symbol: 'pt', category: 'volume', toBase: 0.473176473, aliases: ['pint', 'pints'] },
  { id: 'qt', symbol: 'qt', category: 'volume', toBase: 0.946352946, aliases: ['qt', 'quart', 'quarts'] },
  { id: 'gal', symbol: 'gal', category: 'volume', toBase: 3.785411784, aliases: ['gal', 'gallon', 'gallons'] },

  // Area (base: m²)
  { id: 'cm2', symbol: 'cm²', category: 'area', toBase: 0.0001, aliases: ['cm2', 'cm²', 'sq cm', 'sqft_cm'] },
  { id: 'm2', symbol: 'm²', category: 'area', toBase: 1, aliases: ['m2', 'm²', 'sqm', 'sq m', 'square meter', 'square meters'] },
  { id: 'km2', symbol: 'km²', category: 'area', toBase: 1_000_000, aliases: ['km2', 'km²', 'sq km', 'square kilometer', 'square kilometers'] },
  { id: 'in2', symbol: 'in²', category: 'area', toBase: 0.00064516, aliases: ['in2', 'in²', 'sq in', 'square inch', 'square inches'] },
  { id: 'ft2', symbol: 'ft²', category: 'area', toBase: 0.09290304, aliases: ['ft2', 'ft²', 'sqft', 'sq ft', 'square foot', 'square feet'] },
  { id: 'acre', symbol: 'acre', category: 'area', toBase: 4046.8564224, aliases: ['acre', 'acres'] },
  { id: 'ha', symbol: 'ha', category: 'area', toBase: 10_000, aliases: ['ha', 'hectare', 'hectares'] },

  // Speed (base: m/s)
  { id: 'mps', symbol: 'm/s', category: 'speed', toBase: 1, aliases: ['mps', 'm/s'] },
  { id: 'kph', symbol: 'km/h', category: 'speed', toBase: 1 / 3.6, aliases: ['kph', 'kmh', 'km/h'] },
  { id: 'mph', symbol: 'mph', category: 'speed', toBase: 0.44704, aliases: ['mph'] },
  { id: 'knot', symbol: 'kn', category: 'speed', toBase: 0.514444444, aliases: ['knot', 'knots', 'kn'] },

  // Digital / Data (base: byte)
  { id: 'bit', symbol: 'bit', category: 'data', toBase: 0.125, aliases: ['bit', 'bits', 'b'] },
  { id: 'B', symbol: 'B', category: 'data', toBase: 1, aliases: ['byte', 'bytes'] },
  { id: 'KB', symbol: 'KB', category: 'data', toBase: 1000, aliases: ['kb', 'kilobyte', 'kilobytes'] },
  { id: 'MB', symbol: 'MB', category: 'data', toBase: 1_000_000, aliases: ['mb', 'megabyte', 'megabytes'] },
  { id: 'GB', symbol: 'GB', category: 'data', toBase: 1_000_000_000, aliases: ['gb', 'gigabyte', 'gigabytes'] },
  { id: 'TB', symbol: 'TB', category: 'data', toBase: 1_000_000_000_000, aliases: ['tb', 'terabyte', 'terabytes'] },
  { id: 'PB', symbol: 'PB', category: 'data', toBase: 1_000_000_000_000_000, aliases: ['pb', 'petabyte', 'petabytes'] },
  { id: 'KiB', symbol: 'KiB', category: 'data', toBase: 1024, aliases: ['kib', 'kibibyte', 'kibibytes'] },
  { id: 'MiB', symbol: 'MiB', category: 'data', toBase: 1024 ** 2, aliases: ['mib', 'mebibyte', 'mebibytes'] },
  { id: 'GiB', symbol: 'GiB', category: 'data', toBase: 1024 ** 3, aliases: ['gib', 'gibibyte', 'gibibytes'] },
  { id: 'TiB', symbol: 'TiB', category: 'data', toBase: 1024 ** 4, aliases: ['tib', 'tebibyte', 'tebibytes'] },

  // Time (base: second)
  { id: 'ms', symbol: 'ms', category: 'time', toBase: 0.001, aliases: ['ms', 'millisecond', 'milliseconds'] },
  { id: 's', symbol: 's', category: 'time', toBase: 1, aliases: ['s', 'sec', 'secs', 'second', 'seconds'] },
  { id: 'min', symbol: 'min', category: 'time', toBase: 60, aliases: ['min', 'mins', 'minute', 'minutes'] },
  { id: 'h', symbol: 'h', category: 'time', toBase: 3600, aliases: ['h', 'hr', 'hrs', 'hour', 'hours'] },
  { id: 'day', symbol: 'days', category: 'time', toBase: 86400, aliases: ['d', 'day', 'days'] },
  { id: 'week', symbol: 'weeks', category: 'time', toBase: 604800, aliases: ['wk', 'wks', 'week', 'weeks'] },
  { id: 'month', symbol: 'months', category: 'time', toBase: 2629746, aliases: ['mo', 'month', 'months'] },
  { id: 'year', symbol: 'years', category: 'time', toBase: 31556952, aliases: ['yr', 'yrs', 'year', 'years'] },

  // Angle (base: radian)
  { id: 'deg', symbol: '°', category: 'angle', toBase: Math.PI / 180, aliases: ['deg', 'degree', 'degrees', '°'] },
  { id: 'rad', symbol: 'rad', category: 'angle', toBase: 1, aliases: ['rad', 'radian', 'radians'] },

  // CSS (base: px, 16px = 1rem)
  { id: 'px', symbol: 'px', category: 'css', toBase: 1, aliases: ['px', 'pixel', 'pixels'] },
  { id: 'pt', symbol: 'pt', category: 'css', toBase: 96 / 72, aliases: ['pt', 'pts', 'point', 'points'] },
  { id: 'rem', symbol: 'rem', category: 'css', toBase: 16, aliases: ['rem', 'em'] },
];

export const UNITS_BY_ID: Record<string, UnitDef> = {};
const ALIAS_MAP: Record<string, UnitDef> = {};

for (const u of UNIT_LIST) {
  UNITS_BY_ID[u.id] = u;
  ALIAS_MAP[u.id.toLowerCase()] = u;
  for (const a of u.aliases) {
    ALIAS_MAP[a.toLowerCase()] = u;
  }
}

export function resolveUnit(raw: string): UnitDef | null {
  const trimmed = raw.trim();
  if (trimmed === 'B') return UNITS_BY_ID.B;
  if (trimmed === 'b') return UNITS_BY_ID.bit;
  if (trimmed === 'in') return UNITS_BY_ID.in;
  return ALIAS_MAP[trimmed.toLowerCase()] ?? null;
}

export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const defA = UNITS_BY_ID[unitA];
  const defB = UNITS_BY_ID[unitB];
  return Boolean(defA && defB && defA.category === defB.category);
}

export function convertUnitValue(amount: number, fromUnitId: string, toUnitId: string): number | null {
  const from = UNITS_BY_ID[fromUnitId];
  const to = UNITS_BY_ID[toUnitId];
  if (!from || !to || from.category !== to.category) return null;
  if (from.id === to.id) return amount;

  if (from.category === 'temperature') {
    let celsius = amount;
    if (from.id === 'F') celsius = ((amount - 32) * 5) / 9;
    else if (from.id === 'K') celsius = amount - 273.15;

    if (to.id === 'C') return celsius;
    if (to.id === 'F') return (celsius * 9) / 5 + 32;
    if (to.id === 'K') return celsius + 273.15;
    return celsius;
  }

  const inBase = amount * from.toBase;
  return inBase / to.toBase;
}
