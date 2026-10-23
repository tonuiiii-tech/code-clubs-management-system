import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  Textarea,
  useToast,
} from 'steamlabsui';
import { SESSION_STATUSES } from '@code-clubs/shared/enums';
import { createSessionSchema, updateSessionSchema } from '@code-clubs/shared/schemas';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useClubOptions } from '../../utils/useClubOptions.js';
import { useForm, withoutEmpty } from '../../utils/useForm.js';
import { createSession, getSession, updateSession } from '../../services/sessionsService.js';

const EMPTY = {
  clubId: '',
  date: '',
  status: 'held',
  topic: '',
  notes: '',
  startTime: '',
  endTime: '',
  cancellationReason: '',
};

const noSession = async () => ({ data: null });

/** Report a session (/sessions/new) or change its report (/sessions/:id/edit). */
export function SessionFormPage() {
  const { id } = useParams();
  const session = useApi(id ? getSession : noSession, id);
  const clubs = useClubOptions({ activeOnly: true });
  return (
    <DataState
      loading={session.loading || clubs.loading}
      error={session.error ?? clubs.error}
      onRetry={clubs.reload}
    >
      <SessionForm
        key={session.data?.data?.id ?? 'new'}
        session={session.data?.data}
        clubs={clubs.clubs}
      />
    </DataState>
  );
}

function SessionForm({ session, clubs }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editing = Boolean(session);

  const form = useForm({
    initial: editing
      ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, String(session[k] ?? '')]))
      : {
          ...EMPTY,
          clubId: params.get('clubId') ?? '',
          date: new Date().toISOString().slice(0, 10),
        },
    toInput: ({ clubId, ...values }) => withoutEmpty(editing ? values : { clubId, ...values }),
    schema: editing ? updateSessionSchema : createSessionSchema,
    onSubmit: async (body) => {
      const { data } = editing ? await updateSession(session.id, body) : await createSession(body);
      toast({ title: t(editing ? 'sessions.saved' : 'sessions.created'), tone: 'success' });
      navigate(`/sessions/${data.id}`);
    },
  });
  const { bind, errors, values } = form;

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to={editing ? `/sessions/${session.id}` : '/sessions'}>{t('common.back')}</Link>
          </BackLink>
        }
        title={editing ? t('sessions.edit') : t('sessions.add')}
        description={editing ? session.date : undefined}
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
              {!editing && (
                <Field label={t('sessions.club')} error={errors.clubId} required>
                  <Select {...bind('clubId')}>
                    <option value="">{t('learners.chooseClub')}</option>
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label={t('sessions.date')} error={errors.date} required>
                <Input {...bind('date')} type="date" />
              </Field>
              <Field label={t('sessions.status')} error={errors.status} required>
                <EnumSelect
                  {...bind('status')}
                  values={SESSION_STATUSES}
                  labelKey="sessionStatuses"
                />
              </Field>
              <Field
                label={t('sessions.topic')}
                error={errors.topic}
                required={values.status === 'held'}
              >
                <Input {...bind('topic')} autoComplete="off" />
              </Field>
              <Field
                label={t('sessions.startTime')}
                error={errors.startTime}
                hint={t('sessions.timesHint')}
              >
                <Input {...bind('startTime')} type="time" />
              </Field>
              <Field label={t('sessions.endTime')} error={errors.endTime}>
                <Input {...bind('endTime')} type="time" />
              </Field>
              {values.status === 'cancelled' && (
                <Field label={t('sessions.cancellationReason')} error={errors.cancellationReason}>
                  <Input {...bind('cancellationReason')} autoComplete="off" />
                </Field>
              )}
            </div>
            <Field label={t('sessions.notes')} error={errors.notes} className="form-section">
              <Textarea {...bind('notes')} rows={4} maxLength={1000} />
            </Field>
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
