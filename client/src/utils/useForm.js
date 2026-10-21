import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFieldErrors, issuesToFieldErrors } from './formErrors.js';

/**
 * Small form helper: values, per-field errors and a submit that validates with a shared
 * Zod schema first (same rules as the server, D1-3), then shows server errors on the fields.
 *
 * @param {object} initial         starting values (strings for inputs)
 * @param {(values) => object} toInput  turns form values into the API body
 * @param {import('zod').ZodType} schema
 * @param {(body) => Promise<unknown>} onSubmit
 */
export function useForm({ initial, toInput = (v) => v, schema, onSubmit }) {
  const { t } = useTranslation();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = useCallback((name, value) => setValues((v) => ({ ...v, [name]: value })), []);
  const bind = useCallback(
    (name) => ({
      name,
      value: values[name] ?? '',
      onChange: (e) => set(name, e.target.value),
    }),
    [values, set],
  );

  async function handleSubmit(e) {
    e?.preventDefault();
    setFormError(null);
    const body = toInput(values);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(t, parsed.error.issues));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      const fieldErrors = apiFieldErrors(t, err);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setFormError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return { values, set, bind, errors, formError, submitting, handleSubmit };
}

/** Drops empty strings so optional fields are left out of the request. */
export function withoutEmpty(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== '' && value !== undefined),
  );
}
