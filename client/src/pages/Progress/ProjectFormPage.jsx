import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  Select,
  Textarea,
  useToast,
} from 'steamlabsui';
import { TRACKS } from '@code-clubs/shared/enums';
import { createProjectSchema, updateProjectSchema } from '@code-clubs/shared/schemas';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useClubOptions } from '../../utils/useClubOptions.js';
import { useForm, withoutEmpty } from '../../utils/useForm.js';
import { shrinkPhoto } from '../../utils/files.js';
import { listLearners } from '../../services/learnersService.js';
import {
  createProject,
  getProject,
  updateProject,
  uploadProjectFile,
} from '../../services/progressService.js';

const noProject = async () => ({ data: null });
const today = () => new Date().toISOString().slice(0, 10);
const clubLearners = (clubId) =>
  clubId ? listLearners({ clubId, pageSize: 100 }) : Promise.resolve({ data: [] });

/**
 * Record a project learners made (/projects/new?clubId=…&learnerId=…) or change one
 * (/projects/:id/edit), with a link, a file or a photo; also offline (US-29).
 */
export function ProjectFormPage() {
  const { id } = useParams();
  const project = useApi(id ? getProject : noProject, id);
  const clubs = useClubOptions({ activeOnly: true });
  return (
    <DataState
      loading={project.loading || clubs.loading}
      error={project.error ?? clubs.error}
      onRetry={project.reload}
    >
      <ProjectForm
        key={project.data?.data?.id ?? 'new'}
        project={project.data?.data}
        clubs={clubs.clubs}
      />
    </DataState>
  );
}

function ProjectForm({ project, clubs }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editing = Boolean(project);
  const startLearner = params.get('learnerId');
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const back = params.get('back') ?? (editing ? `/clubs/${project.clubId}` : '/');

  const form = useForm({
    initial: {
      clubId: project?.clubId ?? params.get('clubId') ?? clubs[0]?.id ?? '',
      title: project?.title ?? '',
      track: project?.track ?? 'scratch',
      date: project?.date ?? today(),
      learnerIds: project?.learnerIds ?? (startLearner ? [startLearner] : []),
      link: project?.link ?? '',
      note: project?.note ?? '',
    },
    toInput: ({ clubId, link, ...values }) => {
      const body = { ...withoutEmpty(values), ...(link ? { link } : editing && { link: null }) };
      return editing ? body : { ...body, clubId };
    },
    schema: editing ? updateProjectSchema : createProjectSchema,
    onSubmit: async (body) => {
      const result = editing ? await updateProject(project.id, body) : await createProject(body);
      if (file) {
        const done = await sendFile(result.data.id, false);
        if (!done) return;
      }
      finish();
    },
  });
  const { bind, errors, values, set } = form;
  const learners = useApi(clubLearners, values.clubId);
  const choices = (learners.data?.data ?? []).filter(
    (l) => l.status === 'active' || values.learnerIds.includes(l.id),
  );
  const toggle = (id, on) =>
    set('learnerIds', on ? [...values.learnerIds, id] : values.learnerIds.filter((l) => l !== id));

  function finish() {
    toast({ title: t(editing ? 'projects.saved' : 'projects.created'), tone: 'success' });
    navigate(back);
  }

  /** Returns false while waiting for the photo consent question. */
  async function sendFile(projectId, confirmConsent) {
    try {
      await uploadProjectFile(projectId, file, confirmConsent);
      return true;
    } catch (err) {
      if (err.code !== 'PHOTO_CONSENT_MISSING') throw err;
      setConfirmed(false);
      setConsent({ projectId, missing: err.details ?? [] });
      return false;
    }
  }

  async function choose(e) {
    const chosen = e.target.files?.[0] ?? null;
    setFile(chosen && chosen.type.startsWith('image/') ? await shrinkPhoto(chosen) : chosen);
  }

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to={back}>{t('common.back')}</Link>
          </BackLink>
        }
        title={editing ? t('projects.edit') : t('projects.add')}
        description={t('projects.description')}
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
                <Field label={t('projects.club')} error={errors.clubId} required>
                  <Select
                    {...bind('clubId')}
                    onChange={(e) => {
                      set('clubId', e.target.value);
                      set('learnerIds', []);
                    }}
                  >
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label={t('projects.projectTitle')} error={errors.title} required>
                <Input {...bind('title')} autoComplete="off" />
              </Field>
              <Field label={t('projects.track')} error={errors.track} required>
                <EnumSelect {...bind('track')} values={TRACKS} labelKey="tracks" />
              </Field>
              <Field label={t('projects.date')} error={errors.date} required>
                <Input {...bind('date')} type="date" max={today()} />
              </Field>
            </div>
            <fieldset className="form-section">
              <legend>{t('projects.members')}</legend>
              <p className="muted">{errors.learnerIds ?? t('projects.membersHint')}</p>
              <div className="checkbox-grid">
                {choices.map((l) => (
                  <Checkbox
                    key={l.id}
                    label={`${l.firstName} ${l.lastName}`}
                    checked={values.learnerIds.includes(l.id)}
                    onChange={(e) => toggle(l.id, e.target.checked)}
                  />
                ))}
              </div>
            </fieldset>
            <Field
              label={t('projects.link')}
              error={errors.link}
              hint={t('projects.linkHint')}
              className="form-section"
            >
              <Input {...bind('link')} type="url" inputMode="url" autoComplete="off" />
            </Field>
            <Field
              label={t('projects.file')}
              hint={project?.hasFile ? t('projects.replaceFileHint') : t('projects.fileHint')}
              className="form-section"
            >
              <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={choose} />
            </Field>
            <Field label={t('projects.note')} error={errors.note} className="form-section">
              <Textarea {...bind('note')} rows={2} maxLength={1000} />
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
      {consent && (
        <Dialog
          open
          onClose={() => finish()}
          title={t('sessions.photoConsentTitle')}
          footer={
            <>
              <Button variant="outline" onClick={() => finish()}>
                {t('projects.skipPhoto')}
              </Button>
              <Button
                disabled={!confirmed}
                onClick={async () => {
                  await sendFile(consent.projectId, true);
                  finish();
                }}
              >
                {t('projects.addPhoto')}
              </Button>
            </>
          }
        >
          <div className="stack">
            <p>{t('projects.photoConsentBody')}</p>
            <ul>
              {consent.missing.map((m) => (
                <li key={m.learnerId}>{m.name}</li>
              ))}
            </ul>
            <Checkbox
              label={t('sessions.photoConsentConfirm')}
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
          </div>
        </Dialog>
      )}
    </>
  );
}
