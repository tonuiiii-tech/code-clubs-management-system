import { lazy, Suspense, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Field,
  Heading,
  Input,
  Lead,
} from 'steamlabsui';
import { loginSchema } from '@code-clubs/shared/schemas';
import { issuesToFieldErrors } from '../../utils/formErrors.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { LanguageSwitcher } from '../../components/LanguageSwitcher.jsx';

// Loaded only in mock mode, so the demo accounts and mock data never ship in a real build.
const DemoAccounts =
  import.meta.env.VITE_USE_MOCKS === 'true'
    ? lazy(() => import('./DemoAccounts.jsx').then((m) => ({ default: m.DemoAccounts })))
    : null;

export function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function signIn(email, password) {
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname ?? '/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    // Same shared schema the server uses (D1-3); the server still validates again.
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(issuesToFieldErrors(t, parsed.error.issues));
      return;
    }
    setFieldErrors({});
    signIn(parsed.data.email, parsed.data.password);
  }

  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <LanguageSwitcher />
        </div>
        <Heading size="h2" as="h1">
          {t('login.title')}
        </Heading>
        <Lead>{t('login.intro')}</Lead>
      </CardHeader>
      <CardContent>
        <form className="stack" onSubmit={onSubmit} noValidate>
          {error && (
            <Alert tone="danger" title={t('login.failed')}>
              {error.message}
            </Alert>
          )}
          <Field label={t('login.email')} error={fieldErrors.email} required>
            <Input
              name="email"
              type="email"
              autoComplete="username"
              value={form.email}
              onChange={onChange}
            />
          </Field>
          <Field label={t('login.password')} error={fieldErrors.password} required>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={onChange}
            />
          </Field>
          <Button type="submit" loading={submitting}>
            {t('login.submit')}
          </Button>
        </form>
        {DemoAccounts && (
          <Suspense fallback={null}>
            <DemoAccounts disabled={submitting} onSignIn={signIn} />
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
}
