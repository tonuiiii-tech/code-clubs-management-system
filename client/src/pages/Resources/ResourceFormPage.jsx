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
  Field,
  Input,
  PageHeader,
  Textarea,
  useToast,
} from 'steamlabsui';
import {
  AGE_BANDS,
  LANGUAGES,
  RESOURCE_FILE_TYPES,
  RESOURCE_STATUSES,
  RESOURCE_TYPES,
  TRACKS,
} from '@code-clubs/shared/enums';
import {
  createResourceSchema,
  resourceExtension,
  updateResourceSchema,
} from '@code-clubs/shared/schemas';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useForm } from '../../utils/useForm.js';
import {
  createResource,
  deleteResource,
  getResource,
  updateResource,
  uploadResourceFile,
} from '../../services/resourcesService.js';

const noResource = async () => ({ data: null });
const ACCEPT = Object.keys(RESOURCE_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(',');

/** HQ adds a resource (/resources/new) or changes it (/resources/:id/edit), with its file. */
export function ResourceFormPage() {
  const { id } = useParams();
  const resource = useApi(id ? getResource : noResource, id);
  return (
    <DataState loading={resource.loading} error={resource.error} onRetry={resource.reload}>
      <ResourceForm key={resource.data?.data?.id ?? 'new'} resource={resource.data?.data} />
    </DataState>
  );
}

function ResourceForm({ resource }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const editing = Boolean(resource);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const form = useForm({
    initial: {
      title: resource?.title ?? '',
      description: resource?.description ?? '',
      type: resource?.type ?? 'lesson_plan',
      tracks: resource?.tracks ?? [],
      ageBands: resource?.ageBands ?? [],
      language: resource?.language ?? 'en',
      link: resource?.link ?? '',
      status: resource?.status ?? 'draft',
    },
    toInput: ({ link, description, ...values }) => ({
      ...values,
      ...(description && { description }),
      ...(link ? { link } : editing && resource.link && { link: null }),
    }),
    schema: editing ? updateResourceSchema : createResourceSchema,
    onSubmit: async (body) => {
      // A new resource with a file is saved as a draft first, then published with its file.
      const publish = body.status === 'published' && file;
      let result = editing
        ? await updateResource(resource.id, publish ? { ...body, status: resource.status } : body)
        : await createResource(publish ? { ...body, status: 'draft' } : body);
      if (file) result = await uploadResourceFile(result.data.id, file);
      if (publish) result = await updateResource(result.data.id, { status: 'published' });
      toast({
        title: t(editing ? 'resources.savedResource' : 'resources.created'),
        tone: 'success',
      });
      navigate(`/resources/${result.data.id}`);
    },
  });
  const { bind, errors, values, set } = form;
  const toggle = (key, value, on) =>
    set(key, on ? [...values[key], value] : values[key].filter((v) => v !== value));

  function choose(e) {
    const chosen = e.target.files?.[0] ?? null;
    setFileError(null);
    if (chosen && !resourceExtension(chosen.name)) {
      setFileError(t('apiErrors.resourceFileType'));
      e.target.value = '';
      return;
    }
    setFile(chosen);
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteResource(resource.id);
      toast({ title: t('resources.deleted'), tone: 'success' });
      navigate('/resources');
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to={editing ? `/resources/${resource.id}` : '/resources'}>
              {t('common.back')}
            </Link>
          </BackLink>
        }
        title={editing ? t('resources.edit') : t('resources.add')}
        description={t('resources.licenceHint')}
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
              <Field label={t('resources.resourceTitle')} error={errors.title} required>
                <Input {...bind('title')} autoComplete="off" />
              </Field>
              <Field label={t('resources.type')} error={errors.type} required>
                <EnumSelect {...bind('type')} values={RESOURCE_TYPES} labelKey="resourceTypes" />
              </Field>
              <Field label={t('resources.language')} error={errors.language} required>
                <EnumSelect {...bind('language')} values={LANGUAGES} labelKey="language" />
              </Field>
              <Field label={t('resources.status')} error={errors.status} required>
                <EnumSelect
                  {...bind('status')}
                  values={RESOURCE_STATUSES}
                  labelKey="resourceStatuses"
                />
              </Field>
            </div>
            <Field label={t('resources.about')} error={errors.description} className="form-section">
              <Textarea {...bind('description')} rows={3} maxLength={2000} />
            </Field>
            <fieldset className="form-section">
              <legend>{t('resources.tracks')}</legend>
              {errors.tracks && <p className="muted">{errors.tracks}</p>}
              <div className="checkbox-grid">
                {TRACKS.map((tr) => (
                  <Checkbox
                    key={tr}
                    label={t(`tracks.${tr}`)}
                    checked={values.tracks.includes(tr)}
                    onChange={(e) => toggle('tracks', tr, e.target.checked)}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="form-section">
              <legend>{t('resources.ages')}</legend>
              <p className="muted">{t('resources.agesHint')}</p>
              <div className="checkbox-grid">
                {AGE_BANDS.map((band) => (
                  <Checkbox
                    key={band}
                    label={band}
                    checked={values.ageBands.includes(band)}
                    onChange={(e) => toggle('ageBands', band, e.target.checked)}
                  />
                ))}
              </div>
            </fieldset>
            <Field
              label={t('resources.link')}
              error={errors.link}
              hint={t('resources.linkHint')}
              className="form-section"
            >
              <Input {...bind('link')} type="url" inputMode="url" autoComplete="off" />
            </Field>
            {values.type !== 'video' && (
              <Field
                label={t('resources.file')}
                error={fileError}
                hint={
                  resource?.hasFile
                    ? t('resources.replaceHint', { name: resource.fileName })
                    : t('resources.fileHint')
                }
                className="form-section"
              >
                <input type="file" accept={ACCEPT} onChange={choose} />
              </Field>
            )}
            {values.type === 'video' && (
              <Alert tone="info" className="form-section">
                {t('resources.videoHint')}
              </Alert>
            )}
            <div className="form-actions">
              {editing && (
                <Button variant="ghost" type="button" onClick={() => setDeleting(true)}>
                  {t('resources.delete')}
                </Button>
              )}
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
      <ConfirmDialog
        open={deleting}
        title={t('resources.delete')}
        confirmLabel={t('resources.delete')}
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(false)}
      >
        {t('resources.deleteConfirm')}
      </ConfirmDialog>
    </>
  );
}
