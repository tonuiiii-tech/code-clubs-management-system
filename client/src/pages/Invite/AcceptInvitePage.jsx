import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, CardContent, CardHeader, Field, Heading, Lead } from 'steamlabsui';
import { PASSWORD_MIN_LENGTH } from '@code-clubs/shared/schemas';
import { useAuth } from '../../context/AuthContext.jsx';
import { LanguageSwitcher } from '../../components/LanguageSwitcher.jsx';
import { PasswordInput } from '../../components/PasswordInput.jsx';
import { acceptInvite } from '../../services/usersService.js';

/** /invite/:token: a new person chooses their first password from the emailed link (D5-15). */
export function AcceptInvitePage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const { user } = useAuth();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const errors = {};
    if (form.password.length < PASSWORD_MIN_LENGTH) {
      errors.password = t('invite.tooShort', { count: PASSWORD_MIN_LENGTH });
    } else if (form.password !== form.confirm) {
      errors.confirm = t('invite.mismatch');
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSubmitting(true);
    try {
      const result = await acceptInvite(token, form.password);
      setDone(result.data);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <LanguageSwitcher />
        </div>
        <Heading size="h2" as="h1">
          {t('invite.title')}
        </Heading>
        <Lead>{done ? t('invite.doneIntro', { email: done.email }) : t('invite.intro')}</Lead>
      </CardHeader>
      <CardContent>
        {done ? (
          <Button asChild>
            <Link to="/login">{t('login.submit')}</Link>
          </Button>
        ) : (
          <form className="stack" onSubmit={onSubmit} noValidate>
            {error && (
              <Alert tone="danger" title={t('common.error')}>
                {error.message}
              </Alert>
            )}
            <Field
              label={t('invite.password')}
              hint={t('invite.tooShort', { count: PASSWORD_MIN_LENGTH })}
              error={fieldErrors.password}
              required
            >
              <PasswordInput
                name="password"
                autoComplete="new-password"
                value={form.password}
                onChange={onChange}
              />
            </Field>
            <Field label={t('invite.confirm')} error={fieldErrors.confirm} required>
              <PasswordInput
                name="confirm"
                autoComplete="new-password"
                value={form.confirm}
                onChange={onChange}
              />
            </Field>
            <Button type="submit" loading={submitting}>
              {t('invite.submit')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
