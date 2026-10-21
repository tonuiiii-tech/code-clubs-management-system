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
  Select,
  useToast,
} from 'steamlabsui';
import {
  CLUB_MAX_CAPACITY,
  CLUB_STATUSES,
  MEETING_DAYS,
  MEETING_FREQUENCIES,
  TRACKS,
} from '@code-clubs/shared/enums';
import { createClubSchema, updateClubSchema } from '@code-clubs/shared/schemas';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useForm, withoutEmpty } from '../../utils/useForm.js';
import { createClub, getClub, updateClub } from '../../services/clubsService.js';
import { listSchools } from '../../services/schoolsService.js';

/** Online clubs wait for a decision on how they get a region (open question), so not offered yet. */
const SCHOOL_VENUES = { primary_school: 'primary_school', library: 'library' };

const EMPTY = {
  name: '',
  schoolId: '',
  meetingDay: '',
  startTime: '',
  endTime: '',
  frequency: 'weekly',
  mainTrack: '',
  capacity: String(CLUB_MAX_CAPACITY),
  status: 'active',
};

const noClub = async () => ({ data: null });
const activeSchools = () => listSchools({ status: 'active', pageSize: 100 });

/** Create (/clubs/new) and edit (/clubs/:id/edit). */
export function ClubFormPage() {
  const { id } = useParams();
  const club = useApi(id ? getClub : noClub, id);
  const schools = useApi(activeSchools);
  return (
    <DataState
      loading={club.loading || schools.loading}
      error={club.error ?? schools.error}
      onRetry={schools.reload}
    >
      <ClubForm
        key={club.data?.data?.id ?? 'new'}
        club={club.data?.data}
        schools={schools.data?.data ?? []}
      />
    </DataState>
  );
}

function ClubForm({ club, schools }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const editing = Boolean(club);

  const toInput = ({ capacity, status, ...values }) => {
    const school = schools.find((s) => s.id === values.schoolId);
    const input = {
      ...withoutEmpty(values),
      capacity: capacity === '' ? undefined : Number(capacity),
      // The venue follows the school's type; the server takes the region from the school too.
      venueType: SCHOOL_VENUES[school?.type] ?? (school ? 'community_centre' : undefined),
    };
    if (editing) {
      delete input.schoolId;
      delete input.venueType;
      input.status = status;
    }
    return withoutEmpty(input);
  };

  const form = useForm({
    initial: club
      ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, String(club[k] ?? '')]))
      : EMPTY,
    toInput,
    schema: editing ? updateClubSchema : createClubSchema,
    onSubmit: async (body) => {
      const { data } = editing ? await updateClub(club.id, body) : await createClub(body);
      toast({ title: t(editing ? 'clubs.saved' : 'clubs.created'), tone: 'success' });
      navigate(`/clubs/${data.id}`);
    },
  });
  const { bind, errors } = form;

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to={editing ? `/clubs/${club.id}` : '/clubs'}>{t('common.back')}</Link>
          </BackLink>
        }
        title={editing ? t('clubs.edit') : t('clubs.add')}
        description={editing ? `${club.code} · ${club.name}` : undefined}
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
              <Field label={t('clubs.name')} error={errors.name} required>
                <Input {...bind('name')} autoComplete="off" />
              </Field>
              {!editing && (
                <Field
                  label={t('clubs.school')}
                  error={errors.schoolId ?? errors.venueType}
                  required
                >
                  <Select {...bind('schoolId')}>
                    <option value="">{t('clubs.chooseSchool')}</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.county})
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label={t('clubs.meetingDay')} error={errors.meetingDay} required>
                <EnumSelect
                  {...bind('meetingDay')}
                  values={MEETING_DAYS}
                  labelKey="days"
                  placeholder=""
                />
              </Field>
              <Field label={t('clubs.startTime')} error={errors.startTime} required>
                <Input {...bind('startTime')} type="time" />
              </Field>
              <Field label={t('clubs.endTime')} error={errors.endTime} required>
                <Input {...bind('endTime')} type="time" />
              </Field>
              <Field label={t('clubs.frequency')} error={errors.frequency} required>
                <EnumSelect
                  {...bind('frequency')}
                  values={MEETING_FREQUENCIES}
                  labelKey="frequencies"
                />
              </Field>
              <Field label={t('clubs.track')} error={errors.mainTrack} required>
                <EnumSelect
                  {...bind('mainTrack')}
                  values={TRACKS}
                  labelKey="tracks"
                  placeholder=""
                />
              </Field>
              <Field
                label={t('clubs.capacity')}
                error={errors.capacity}
                hint={t('clubs.capacityHint', { max: CLUB_MAX_CAPACITY })}
                required
              >
                <Input {...bind('capacity')} type="number" min={1} max={CLUB_MAX_CAPACITY} />
              </Field>
              {editing && (
                <Field label={t('clubs.status')} error={errors.status} required>
                  <EnumSelect {...bind('status')} values={CLUB_STATUSES} labelKey="status" />
                </Field>
              )}
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
