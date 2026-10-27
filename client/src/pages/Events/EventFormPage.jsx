import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  BackLink,
  Button,
  Card,
  CardContent,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from 'steamlabsui';
import { EVENT_STATUSES, EVENT_TYPES, REGION_VALUES } from '@code-clubs/shared/enums';
import { createEventSchema, updateEventSchema } from '@code-clubs/shared/schemas';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useClubOptions } from '../../utils/useClubOptions.js';
import { useForm, withoutEmpty } from '../../utils/useForm.js';
import { createEvent, getEvent, setEventClubs, updateEvent } from '../../services/eventsService.js';

const FIELDS = [
  'name',
  'type',
  'startDate',
  'endDate',
  'venue',
  'region',
  'description',
  'capacity',
  'registrationCloses',
  'status',
];
const noEvent = async () => ({ data: null });
const NATIONAL = 'national';

/** Create an event (/events/new) or change it (/events/:id/edit), with the invited clubs. */
export function EventFormPage() {
  const { id } = useParams();
  const event = useApi(id ? getEvent : noEvent, id);
  const clubs = useClubOptions({ activeOnly: true });
  return (
    <DataState
      loading={event.loading || clubs.loading}
      error={event.error ?? clubs.error}
      onRetry={event.reload}
    >
      <EventForm key={event.data?.data?.id ?? 'new'} event={event.data?.data} clubs={clubs.clubs} />
    </DataState>
  );
}

function EventForm({ event, clubs }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const editing = Boolean(event);
  const coordinator = user.role === 'coordinator';
  const regions = coordinator ? (user.regions ?? []) : REGION_VALUES;

  const form = useForm({
    initial: {
      ...Object.fromEntries(FIELDS.map((k) => [k, String(event?.[k] ?? '')])),
      type: event?.type ?? 'showcase',
      status: event?.status ?? 'planned',
      region: event ? (event.region ?? NATIONAL) : coordinator ? regions[0] : NATIONAL,
      clubIds: event?.clubIds ?? [],
    },
    toInput: ({ clubIds, region, capacity, ...values }) => {
      const body = {
        ...withoutEmpty(values),
        region: region === NATIONAL ? null : region,
        ...(capacity && { capacity: Number(capacity) }),
      };
      return editing ? body : { ...body, clubIds };
    },
    schema: editing ? updateEventSchema : createEventSchema,
    onSubmit: async (body) => {
      let result;
      if (editing) {
        result = await updateEvent(event.id, body);
        const before = [...event.clubIds].sort().join();
        if ([...form.values.clubIds].sort().join() !== before) {
          result = await setEventClubs(event.id, form.values.clubIds);
        }
      } else {
        result = await createEvent(body);
      }
      toast({ title: t(editing ? 'events.saved' : 'events.created'), tone: 'success' });
      navigate(`/events/${result.data.id}`);
    },
  });
  const { bind, errors, values, set } = form;
  const region = values.region === NATIONAL ? null : values.region;
  const invitable = clubs.filter((c) => !region || c.region === region);
  const toggleClub = (id, on) =>
    set('clubIds', on ? [...values.clubIds, id] : values.clubIds.filter((c) => c !== id));

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to={editing ? `/events/${event.id}` : '/events'}>{t('common.back')}</Link>
          </BackLink>
        }
        title={editing ? t('events.edit') : t('events.add')}
        description={editing ? event.name : undefined}
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
              <Field label={t('events.name')} error={errors.name} required>
                <Input {...bind('name')} autoComplete="off" />
              </Field>
              <Field label={t('events.type')} error={errors.type} required>
                <EnumSelect {...bind('type')} values={EVENT_TYPES} labelKey="eventTypes" />
              </Field>
              <Field label={t('events.startDate')} error={errors.startDate} required>
                <Input {...bind('startDate')} type="date" />
              </Field>
              <Field label={t('events.endDate')} error={errors.endDate} required>
                <Input {...bind('endDate')} type="date" />
              </Field>
              <Field label={t('events.venue')} error={errors.venue} required>
                <Input {...bind('venue')} autoComplete="off" />
              </Field>
              <Field label={t('events.region')} error={errors.region} required>
                <Select
                  {...bind('region')}
                  onChange={(e) => {
                    set('region', e.target.value);
                    const next = e.target.value === NATIONAL ? null : e.target.value;
                    set(
                      'clubIds',
                      values.clubIds.filter(
                        (id) => !next || clubs.find((c) => c.id === id)?.region === next,
                      ),
                    );
                  }}
                >
                  {!coordinator && <option value={NATIONAL}>{t('events.national')}</option>}
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {t(`regions.${r}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t('events.capacity')}
                error={errors.capacity}
                hint={t('events.capacityHint')}
              >
                <Input {...bind('capacity')} type="number" min="1" />
              </Field>
              <Field
                label={t('events.registrationCloses')}
                error={errors.registrationCloses}
                hint={t('events.registrationClosesHint')}
              >
                <Input {...bind('registrationCloses')} type="date" />
              </Field>
              <Field label={t('events.status')} error={errors.status} required>
                <EnumSelect {...bind('status')} values={EVENT_STATUSES} labelKey="eventStatuses" />
              </Field>
            </div>
            <Field label={t('events.about')} error={errors.description} className="form-section">
              <Textarea {...bind('description')} rows={3} maxLength={2000} />
            </Field>
            <fieldset className="form-section">
              <legend>{t('events.clubs')}</legend>
              <p className="muted">{t('events.inviteHint')}</p>
              <div className="checkbox-grid">
                {invitable.map((c) => (
                  <Checkbox
                    key={c.id}
                    label={`${c.code} · ${c.name}`}
                    checked={values.clubIds.includes(c.id)}
                    onChange={(e) => toggleClub(c.id, e.target.checked)}
                  />
                ))}
              </div>
            </fieldset>
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
