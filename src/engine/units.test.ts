import { describe, expect, it } from 'vitest';
import { getInitialRates } from './currencies';
import { evaluateSheet } from './evaluator';
import { DEFAULT_SETTINGS } from './storage';
import { highlightLine } from './tokenizer';
import { UNIT_CATEGORIES, UNIT_LIST_PUBLIC, UNITS_BY_ID, unitDisplayName } from './units';

describe('/units reference', () => {
  it('every category example converts to a value', () => {
    const rows = UNIT_CATEGORIES.map((c, i) => ({ id: `r${i}`, text: c.example }));
    const res = evaluateSheet(rows, DEFAULT_SETTINGS, getInitialRates().rates);
    res.forEach((r, i) => {
      expect(r.value, UNIT_CATEGORIES[i].example).toBeTruthy();
      expect(r.formatted, UNIT_CATEGORIES[i].example).toBeTruthy();
    });
  });

  it('every unit belongs to a listed category', () => {
    const ids = new Set(UNIT_CATEGORIES.map((c) => c.id));
    for (const u of UNIT_LIST_PUBLIC) expect(ids.has(u.category)).toBe(true);
  });

  it('tags unit spans with their category for coloring', () => {
    const spans = highlightLine('2 ft in m', new Set());
    const units = spans.filter((s) => s.type === 'unit');
    expect(units.map((s) => s.category)).toEqual(['length', 'length']);
  });

  it('shows readable singular unit names', () => {
    const names = ['s', 'min', 'h', 'day', 'kg', 'in', 'ft', 'C'].map((id) => unitDisplayName(UNITS_BY_ID[id]));
    expect(names).toEqual(['Second', 'Minute', 'Hour', 'Day', 'Kilogram', 'Inch', 'Foot', 'Celsius']);
  });
});
