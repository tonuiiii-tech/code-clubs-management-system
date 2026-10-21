/**
 * Turns validation problems into translated messages per field.
 * Client-side problems come from the shared Zod schemas; server-side ones arrive as
 * error.details [{ field: 'body.name', message }]. Both end up as { 'name': 'message' }.
 */

/** Custom messages written in the shared schemas, mapped to translation keys. */
const KNOWN_MESSAGES = {
  'End time must be after start time': 'validation.endAfterStart',
  'A school is required unless the club meets online': 'validation.schoolRequired',
  'Use the format +2547XXXXXXXX or +2541XXXXXXXX': 'validation.phone',
  'Use HH:mm': 'validation.time',
  'Password is required': 'validation.required',
  'Current password is incorrect': 'validation.currentPassword',
};

function translateIssue(t, issue) {
  if (KNOWN_MESSAGES[issue.message]) return t(KNOWN_MESSAGES[issue.message]);
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined || issue.input === ''
        ? t('validation.required')
        : t('validation.invalid');
    case 'too_small':
      if (issue.origin === 'string') {
        return issue.minimum <= 1
          ? t('validation.required')
          : t('validation.tooShort', { min: issue.minimum });
      }
      return t('validation.tooSmall', { min: issue.minimum });
    case 'too_big':
      return issue.origin === 'string'
        ? t('validation.tooLong', { max: issue.maximum })
        : t('validation.tooBig', { max: issue.maximum });
    case 'invalid_value':
      return t('validation.choose');
    case 'invalid_format':
      return issue.format === 'email' ? t('validation.email') : t('validation.invalid');
    default:
      return t('validation.invalid');
  }
}

/** @param {import('zod').ZodError['issues']} issues */
export function issuesToFieldErrors(t, issues) {
  const errors = {};
  for (const issue of issues) {
    const field = issue.path.join('.');
    errors[field] ??= translateIssue(t, issue);
  }
  return errors;
}

/** Field errors from an ApiError's details, or {} when there are none. */
export function apiFieldErrors(t, error) {
  const errors = {};
  for (const { field, message } of error?.details ?? []) {
    const key = field.replace(/^(body|query|params)\./, '');
    errors[key] ??= KNOWN_MESSAGES[message] ? t(KNOWN_MESSAGES[message]) : message;
  }
  return errors;
}
