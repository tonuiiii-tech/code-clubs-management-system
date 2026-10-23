import { afterEach, describe, expect, it } from 'vitest';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import i18n from '../i18n/index.js';
import { ApiError } from './http.js';

describe('ApiError', () => {
  afterEach(() => i18n.changeLanguage('en'));

  it('shows known server messages in the chosen language', async () => {
    await i18n.changeLanguage('sw');
    expect(new ApiError(401, 'UNAUTHENTICATED', ERROR_MESSAGES.invalidLogin).message).toBe(
      'Barua pepe au nenosiri si sahihi',
    );
    await i18n.changeLanguage('en');
    expect(new ApiError(401, 'UNAUTHENTICATED', ERROR_MESSAGES.invalidLogin).message).toBe(
      'Email or password is incorrect',
    );
  });

  it('shows unknown messages as the server sent them', () => {
    expect(new ApiError(500, 'X', 'Something new').message).toBe('Something new');
  });

  it('has an English and a Kiswahili text for every API error', () => {
    for (const key of Object.keys(ERROR_MESSAGES)) {
      expect(i18n.exists(`apiErrors.${key}`, { lng: 'en' })).toBe(true);
      expect(i18n.getResource('sw', 'common', `apiErrors.${key}`)).toBeTruthy();
    }
  });
});
