import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  BackLink,
  Button,
  Card,
  CardContent,
  Field,
  Input,
  PageHeader,
  useToast,
} from 'steamlabsui';
import { COUNTIES, REGION_VALUES, SCHOOL_TYPES } from '@code-clubs/shared/enums';
import { createSchoolSchema, updateSchoolSchema } from '@code-clubs/shared/schemas';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useForm, withoutEmpty } from '../../utils/useForm.js';
import { createSchool, getSchool, updateSchool } from '../../services/schoolsService.js';

const EMPTY = {
  name: '',
  type: '',
  region: '',
  county: '',
  subCounty: '',
  ward: '',
  lat: '',
  lng: '',
  contactName: '',
  contactPhone: '',
};

function toFormValues(school) {
  return {
    ...EMPTY,
    ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, school[k] ?? ''])),
    lat: school.gps?.lat ?? '',
    lng: school.gps?.lng ?? '',
  };
}

function toInput({ lat, lng, ...values }) {
  const input = withoutEmpty(values);
  if (lat !== '' || lng !== '') input.gps = { lat: Number(lat), lng: Number(lng) };
  return input;
}

const noSchool = async () => ({ data: null });

/** Create (/schools/new) and edit (/schools/:id/edit). */
export function SchoolFormPage() {
  const { id } = useParams();
  const { loading, error, data } = useApi(id ? getSchool : noSchool, id);
  return (
    <DataState loading={loading} error={error}>
      <SchoolForm key={data?.data?.id ?? 'new'} school={data?.data} />
    </DataState>
  );
}

function SchoolForm({ school }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const editing = Boolean(school);
  // Coordinators can only work in their own regions (the server checks this too).
  const regions = user.role === 'coordinator' ? user.regions : REGION_VALUES;

  const form = useForm({
    initial: school
      ? toFormValues(school)
      : { ...EMPTY, region: regions.length === 1 ? regions[0] : '' },
    toInput,
    schema: editing ? updateSchoolSchema : createSchoolSchema,
    onSubmit: async (body) => {
      const { data } = editing ? await updateSchool(school.id, body) : await createSchool(body);
      toast({ title: t(editing ? 'schools.saved' : 'schools.created'), tone: 'success' });
      navigate(`/schools/${data.id}`);
    },
  });
  const { bind, errors } = form;
  const gpsError = errors['gps.lat'] ?? errors['gps.lng'] ?? errors.gps;

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to={editing ? `/schools/${school.id}` : '/schools'}>{t('common.back')}</Link>
          </BackLink>
        }
        title={editing ? t('schools.edit') : t('schools.add')}
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
              <Field label={t('schools.name')} error={errors.name} required>
                <Input {...bind('name')} autoComplete="off" />
              </Field>
              <Field label={t('schools.type')} error={errors.type} required>
                <EnumSelect
                  {...bind('type')}
                  values={SCHOOL_TYPES}
                  labelKey="schoolTypes"
                  placeholder=""
                />
              </Field>
              <Field label={t('schools.region')} error={errors.region} required>
                <EnumSelect
                  {...bind('region')}
                  values={regions}
                  labelKey="regions"
                  placeholder=""
                />
              </Field>
              <Field label={t('schools.county')} error={errors.county} required>
                <EnumSelect {...bind('county')} values={COUNTIES} placeholder="" />
              </Field>
              <Field label={t('schools.subCounty')} error={errors.subCounty} required>
                <Input {...bind('subCounty')} />
              </Field>
              <Field label={t('schools.ward')} error={errors.ward} hint={t('common.optional')}>
                <Input {...bind('ward')} />
              </Field>
              <Field label={t('schools.lat')} error={gpsError} hint="-1.2921">
                <Input {...bind('lat')} inputMode="decimal" />
              </Field>
              <Field label={t('schools.lng')} error={gpsError} hint="36.8219">
                <Input {...bind('lng')} inputMode="decimal" />
              </Field>
              <Field
                label={t('schools.contactName')}
                error={errors.contactName}
                hint={t('common.optional')}
              >
                <Input {...bind('contactName')} />
              </Field>
              <Field
                label={t('schools.contactPhone')}
                error={errors.contactPhone}
                hint="+2547XXXXXXXX"
              >
                <Input {...bind('contactPhone')} type="tel" inputMode="tel" />
              </Field>
            </div>
            <div className="form-actions">
              <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={form.submitting}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
