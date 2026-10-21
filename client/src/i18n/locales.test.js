import { describe, expect, it } from 'vitest';
import en from './locales/en/common.json';
import sw from './locales/sw/common.json';

const keys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('translations', () => {
  it('has every English key in Kiswahili', () => {
    expect(keys(sw).sort()).toEqual(keys(en).sort());
  });
});
