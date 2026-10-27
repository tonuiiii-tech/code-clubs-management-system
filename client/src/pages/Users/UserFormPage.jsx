import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  BackLink,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  Field,
  Input,
  PageHeader,
  useToast,
} from 'steamlabsui';
import {
  CHAMPION_TYPES,
  LANGUAGES,
  REGION_VALUES,
  ROLE_VALUES,
  ROLES,
  SAFEGUARDING_STATUSES,
} from '@code-clubs/shared/enums';
import { createUserSchema, updateUserSchema } from '@code-clubs/shared/schemas';
import { canManageRole } from '@code-clubs/shared/permissions';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useForm, withoutEmpty } from '../../utils/useForm.js';
import { createUser, getUser, updateUser } from '../../services/usersService.js';

const EMPTY = {
  fullName: '',
  email: '',
  phone: '',
  role: '',
  regions: [],
  championType: '',
  skills: '',
  safeguardingStatus: 'pending',
  safeguardingDate: '',
  preferredLanguage: 'en',
};

function toFormValues(user) {
  const profile = user.championProfile;
  return {
    ...EMPTY,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone ?? '',
    role: user.role,
    regions: user.regions ?? [],
    championType: profile?.type ?? '',
    skills: profile?.skills?.join(', ') ?? '',
    safeguardingStatus: profile?.safeguarding?.status ?? 'pending',
    safeguardingDate: profile?.safeguarding?.date ?? '',
    preferredLanguage: user.preferredLanguage ?? 'en',
  };
}

/** Region and champion fields only apply to the roles that use them. */
function toInput(values) {
  const { fullName, email, phone, role, regions, preferredLanguage } = values;
  const input = withoutEmpty({ fullName, email, phone, role, preferredLanguage });
  input.regions = role === ROLES.COORDINATOR ? regions : [];
  if (role === ROLES.CHAMPION) {
    input.championProfile = {
      type: values.championType || undefined,
      skills: values.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      safeguarding: withoutEmpty({
        status: values.safeguardingStatus,
        date: values.safeguardingDate,
      }),
    };
  }
  return input;
}

const noUser = async () => ({ data: null });

/** Create (/users/new) and edit (/users/:id/edit). Coordinators only add Club Champions. */
export function UserFormPage() {
  const { id } = useParams();
  const { loading, error, data } = useApi(id ? getUser : noUser, id);
  return (
    <DataState loading={loading} error={error}>
      <UserForm key={data?.data?.id ?? 'new'} user={data?.data} />
    </DataState>
  );
}

function UserForm({ user }) {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [created, setCreated] = useState(null);
  const editing = Boolean(user);
  const editingSelf = editing && user.id === me.id;
  // Only the roles this manager may create (D5-12); editing yourself keeps your role shown.
  const roleChoices = editingSelf
    ? ROLE_VALUES
    : ROLE_VALUES.filter((r) => canManageRole(me, r, editing ? 'user:manage' : 'user:create'));

  const form = useForm({
    // A coordinator can only add Club Champions, so the role is chosen for them (D5-13).
    initial: user
      ? toFormValues(user)
      : { ...EMPTY, role: roleChoices.length === 1 ? roleChoices[0] : '' },
    toInput: (values) => {
      const input = toInput(values);
      if (editingSelf) delete input.role;
      return input;
    },
    schema: editing ? updateUserSchema : createUserSchema,
    onSubmit: async (body) => {
      if (editing) {
        await updateUser(user.id, body);
        toast({ title: t('users.saved'), tone: 'success' });
        navigate('/users');
      } else {
        const result = await createUser(body);
        toast({ title: t('users.created'), tone: 'success' });
        setCreated(result);
      }
    },
  });
  const { bind, errors, values, set } = form;

  const toggleRegion = (region, checked) =>
    set(
      'regions',
      checked ? [...values.regions, region] : values.regions.filter((r) => r !== region),
    );

  return (
    <>
      <PageHeader
        eyebrow={t('nav.users')}
        back={
          <BackLink asChild>
            <Link to="/users">{t('common.back')}</Link>
          </BackLink>
        }
        title={editing ? t('users.edit') : t('users.add')}
      />
      <Card>
        <CardContent className="card-body--top">
          <form onSubmit={form.handleSubmit} noValidate>
            {form.formError && (
              <Alert tone="danger" title={t('common.error')} style={{ marginBottom: '1rem' }}>
                {form.formError.message}
              </Alert>
            )}
            <div className="form-grid">
              <Field label={t('users.fullName')} error={errors.fullName} required>
                <Input {...bind('fullName')} autoComplete="off" />
              </Field>
              <Field label={t('users.email')} error={errors.email} required>
                <Input {...bind('email')} type="email" autoComplete="off" />
              </Field>
              <Field label={t('users.phone')} error={errors.phone} hint="+2547XXXXXXXX">
                <Input {...bind('phone')} type="tel" inputMode="tel" />
              </Field>
              <Field label={t('users.role')} error={errors.role} required>
                <EnumSelect
                  {...bind('role')}
                  values={roleChoices}
                  labelKey="roles"
                  placeholder=""
                  disabled={editingSelf}
                />
              </Field>
              <Field label={t('users.language')} error={errors.preferredLanguage} required>
                <EnumSelect {...bind('preferredLanguage')} values={LANGUAGES} labelKey="language" />
              </Field>
            </div>

            {values.role === ROLES.COORDINATOR && (
              <fieldset className="stack" style={{ border: 0, padding: 0, marginTop: '1.5rem' }}>
                <legend>
                  <strong>{t('users.regions')}</strong>
                </legend>
                <small>{t('users.regionsHint')}</small>
                {REGION_VALUES.map((region) => (
                  <Checkbox
                    key={region}
                    label={t(`regions.${region}`)}
                    checked={values.regions.includes(region)}
                    onChange={(e) => toggleRegion(region, e.target.checked)}
                  />
                ))}
              </fieldset>
            )}

            {values.role === ROLES.CHAMPION && (
              <div className="form-grid" style={{ marginTop: '1.5rem' }}>
                <Field
                  label={t('users.championType')}
                  error={errors['championProfile.type']}
                  required
                >
                  <EnumSelect
                    {...bind('championType')}
                    values={CHAMPION_TYPES}
                    labelKey="championTypes"
                    placeholder=""
                  />
                </Field>
                <Field
                  label={t('users.skills')}
                  hint={t('users.skillsHint')}
                  error={errors['championProfile.skills']}
                >
                  <Input {...bind('skills')} />
                </Field>
                <Field
                  label={t('users.safeguarding')}
                  error={errors['championProfile.safeguarding.status']}
                  required
                >
                  <EnumSelect
                    {...bind('safeguardingStatus')}
                    values={SAFEGUARDING_STATUSES}
                    labelKey="safeguarding"
                  />
                </Field>
                <Field
                  label={t('users.safeguardingDate')}
                  error={errors['championProfile.safeguarding.date']}
                >
                  <Input {...bind('safeguardingDate')} type="date" />
                </Field>
              </div>
            )}

            <div className="form-actions">
              <Button variant="outline" type="button" onClick={() => navigate('/users')}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={form.submitting}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(created)}
        onClose={() => navigate('/users')}
        title={t('users.temporaryPasswordTitle')}
        hideClose
        footer={<Button onClick={() => navigate('/users')}>{t('common.close')}</Button>}
      >
        <div className="stack">
          <p>{t('users.temporaryPasswordBody', { name: created?.data.fullName })}</p>
          <p className="temp-password">{created?.temporaryPassword}</p>
        </div>
      </Dialog>
    </>
  );
}
