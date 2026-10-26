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
  useToast,
} from 'steamlabsui';
import { TRACKS } from '@code-clubs/shared/enums';
import { createAssessmentSchema, updateAssessmentSchema } from '@code-clubs/shared/schemas';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useClubOptions } from '../../utils/useClubOptions.js';
import { useForm } from '../../utils/useForm.js';
import {
  createAssessment,
  getAssessment,
  updateAssessment,
} from '../../services/progressService.js';

const noAssessment = async () => ({ data: null });
const today = () => new Date().toISOString().slice(0, 10);

/** A quiz or test for a club (/assessments/new?clubId=…), or a change to one (US-30). */
export function AssessmentFormPage() {
  const { id } = useParams();
  const assessment = useApi(id ? getAssessment : noAssessment, id);
  const clubs = useClubOptions({ activeOnly: true });
  return (
    <DataState
      loading={assessment.loading || clubs.loading}
      error={assessment.error ?? clubs.error}
      onRetry={assessment.reload}
    >
      <AssessmentForm
        key={assessment.data?.data?.id ?? 'new'}
        assessment={assessment.data?.data}
        clubs={clubs.clubs}
      />
    </DataState>
  );
}

function AssessmentForm({ assessment, clubs }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editing = Boolean(assessment);

  const form = useForm({
    initial: {
      clubId: assessment?.clubId ?? params.get('clubId') ?? clubs[0]?.id ?? '',
      title: assessment?.title ?? '',
      track: assessment?.track ?? 'scratch',
      date: assessment?.date ?? today(),
      maxScore: String(assessment?.maxScore ?? 10),
    },
    toInput: ({ clubId, maxScore, ...values }) => ({
      ...values,
      maxScore: maxScore === '' ? undefined : Number(maxScore),
      ...(!editing && { clubId }),
    }),
    schema: editing ? updateAssessmentSchema : createAssessmentSchema,
    onSubmit: async (body) => {
      const result = editing
        ? await updateAssessment(assessment.id, body)
        : await createAssessment(body);
      toast({ title: t(editing ? 'assessments.saved' : 'assessments.created'), tone: 'success' });
      navigate(`/assessments/${result.data.id}`);
    },
  });
  const { bind, errors } = form;

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to={editing ? `/assessments/${assessment.id}` : '/'}>{t('common.back')}</Link>
          </BackLink>
        }
        title={editing ? t('assessments.edit') : t('assessments.add')}
        description={t('assessments.description')}
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
                <Field label={t('assessments.club')} error={errors.clubId} required>
                  <Select {...bind('clubId')}>
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label={t('assessments.assessmentTitle')} error={errors.title} required>
                <Input {...bind('title')} autoComplete="off" />
              </Field>
              <Field label={t('assessments.track')} error={errors.track} required>
                <EnumSelect {...bind('track')} values={TRACKS} labelKey="tracks" />
              </Field>
              <Field label={t('assessments.date')} error={errors.date} required>
                <Input {...bind('date')} type="date" max={today()} />
              </Field>
              <Field
                label={t('assessments.maxScore')}
                error={errors.maxScore}
                hint={t('assessments.maxScoreHint')}
                required
              >
                <Input {...bind('maxScore')} type="number" min="1" max="1000" inputMode="numeric" />
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
