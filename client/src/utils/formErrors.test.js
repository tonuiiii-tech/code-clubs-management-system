import { describe, expect, it } from 'vitest';
import i18n from '../i18n/index.js';
import { createClubSchema, createSchoolSchema } from '@code-clubs/shared/schemas';
import { apiFieldErrors, issuesToFieldErrors } from './formErrors.js';

const t = i18n.getFixedT('en');
const tSw = i18n.getFixedT('sw');

describe('form error messages', () => {
  it('translates shared-schema problems per field', () => {
    // Forms leave empty fields out (withoutEmpty), so a blank name arrives as missing.
    const { error } = createSchoolSchema.safeParse({
      subCounty: 'K',
      type: '',
      contactPhone: '0712',
    });
    const errors = issuesToFieldErrors(t, error.issues);
    expect(errors.name).toBe('This field is required');
    expect(errors.type).toBe('Choose an option');
    expect(errors.subCounty).toBe('Must be at least 2 characters');
    expect(errors.contactPhone).toBe('Use the format +2547XXXXXXXX or +2541XXXXXXXX');
    expect(issuesToFieldErrors(tSw, error.issues).name).toBe('Sehemu hii inahitajika');
  });

  it('explains the club time rule', () => {
    const { error } = createClubSchema.safeParse({
      name: 'Club',
      venueType: 'library',
      schoolId: '00000000-0000-4000-8000-000000000101',
      meetingDay: 'monday',
      startTime: '16:00',
      endTime: '15:00',
      mainTrack: 'scratch',
    });
    expect(issuesToFieldErrors(t, error.issues).endTime).toBe('End time must be after start time');
  });

  it('maps server error details onto form fields', () => {
    const errors = apiFieldErrors(t, {
      details: [{ field: 'body.currentPassword', message: 'Current password is incorrect' }],
    });
    expect(errors).toEqual({ currentPassword: 'Current password is incorrect' });
  });
});
