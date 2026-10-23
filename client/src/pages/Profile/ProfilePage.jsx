import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageHeader,
  useToast,
} from 'steamlabsui';
import { LANGUAGES } from '@code-clubs/shared/enums';
import {
  changePasswordSchema,
  PASSWORD_MIN_LENGTH,
  updateOwnProfileSchema,
} from '@code-clubs/shared/schemas';
import { useAuth } from '../../context/AuthContext.jsx';
import { Detail } from '../../components/Detail.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { PasswordInput } from '../../components/PasswordInput.jsx';
import { useForm, withoutEmpty } from '../../utils/useForm.js';

/** Everyone can change their own name, phone, language and password; never their role. */
export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <>
      <PageHeader title={t('profile.title')} description={t('profile.description')} />
      <div className="page-grid">
        <Card>
          <CardContent>
            <dl className="detail-list">
              <Detail label={t('users.email')} value={user.email} />
              <Detail label={t('users.role')} value={t(`roles.${user.role}`)} />
              {user.regions?.length > 0 && (
                <Detail
                  label={t('users.regions')}
                  value={user.regions.map((r) => t(`regions.${r}`)).join(', ')}
                />
              )}
            </dl>
          </CardContent>
        </Card>
        <div className="form-grid">
          <ProfileForm user={user} />
          <PasswordForm />
        </div>
      </div>
    </>
  );
}

function ProfileForm({ user }) {
  const { t, i18n } = useTranslation();
  const { updateProfile } = useAuth();
  const { toast } = useToast();
  const form = useForm({
    initial: {
      fullName: user.fullName,
      phone: user.phone ?? '',
      preferredLanguage: user.preferredLanguage ?? 'en',
    },
    toInput: withoutEmpty,
    schema: updateOwnProfileSchema,
    onSubmit: async (body) => {
      const updated = await updateProfile(body);
      i18n.changeLanguage(updated.preferredLanguage);
      toast({ title: t('profile.saved'), tone: 'success' });
    },
  });
  const { bind, errors } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.details')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="stack" onSubmit={form.handleSubmit} noValidate>
          {form.formError && <Alert tone="danger">{form.formError.message}</Alert>}
          <Field label={t('users.fullName')} error={errors.fullName} required>
            <Input {...bind('fullName')} autoComplete="name" />
          </Field>
          <Field label={t('users.phone')} error={errors.phone} hint="+2547XXXXXXXX">
            <Input {...bind('phone')} type="tel" autoComplete="tel" />
          </Field>
          <Field label={t('users.language')} error={errors.preferredLanguage} required>
            <EnumSelect {...bind('preferredLanguage')} values={LANGUAGES} labelKey="language" />
          </Field>
          <div>
            <Button type="submit" loading={form.submitting}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const { t } = useTranslation();
  const { changePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const form = useForm({
    initial: { currentPassword: '', newPassword: '' },
    schema: changePasswordSchema,
    onSubmit: async ({ currentPassword, newPassword }) => {
      await changePassword(currentPassword, newPassword);
      toast({ title: t('profile.passwordChanged'), tone: 'success' });
      navigate('/login');
    },
  });
  const { bind, errors } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.password')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="stack" onSubmit={form.handleSubmit} noValidate>
          {form.formError && <Alert tone="danger">{form.formError.message}</Alert>}
          <Field label={t('profile.currentPassword')} error={errors.currentPassword} required>
            <PasswordInput {...bind('currentPassword')} autoComplete="current-password" />
          </Field>
          <Field
            label={t('profile.newPassword')}
            error={errors.newPassword}
            hint={t('profile.newPasswordHint', { min: PASSWORD_MIN_LENGTH })}
            required
          >
            <PasswordInput {...bind('newPassword')} autoComplete="new-password" />
          </Field>
          <div>
            <Button type="submit" loading={form.submitting}>
              {t('profile.changePassword')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
