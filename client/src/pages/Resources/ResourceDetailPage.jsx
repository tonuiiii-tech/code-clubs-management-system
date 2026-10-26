import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  BackLink,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  TextLink,
  useToast,
} from 'steamlabsui';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { Detail } from '../../components/Detail.jsx';
import { useApi } from '../../utils/useApi.js';
import { saveBlob } from '../../utils/files.js';
import {
  canSaveOffline,
  getResource,
  openResourceFile,
  removeSavedResource,
  saveResourceOnDevice,
} from '../../services/resourcesService.js';
import { megabytes } from './ResourcesPage.jsx';

/** One resource: open its link or file, and save the file on this device (US-28, D5-3). */
export function ResourceDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { can } = useAuth();
  const resource = useApi(getResource, id);
  const data = resource.data?.data;
  const [busy, setBusy] = useState(null);

  async function run(kind, work, done) {
    setBusy(kind);
    try {
      await work();
      if (done) toast({ title: done, tone: 'success' });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  const open = () =>
    run('open', async () => saveBlob(await openResourceFile(data.id), data.fileName));
  const save = () =>
    run(
      'save',
      async () => {
        await saveResourceOnDevice(data);
        resource.reload();
      },
      t('resources.saved'),
    );
  const remove = () =>
    run(
      'remove',
      async () => {
        await removeSavedResource(data.id);
        resource.reload();
      },
      t('resources.removed'),
    );

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to="/resources">{t('common.back')}</Link>
          </BackLink>
        }
        eyebrow={data && t(`resourceTypes.${data.type}`)}
        title={data?.title ?? t('resources.title')}
        meta={
          data && (
            <span className="badge-row">
              {data.status === 'draft' && <Badge>{t('resourceStatuses.draft')}</Badge>}
              {data.saved && <Badge variant="secondary">{t('resources.savedBadge')}</Badge>}
            </span>
          )
        }
        actions={
          data &&
          can('resource:manage') && (
            <Button variant="outline" asChild>
              <Link to={`/resources/${data.id}/edit`}>{t('common.edit')}</Link>
            </Button>
          )
        }
      />
      <DataState loading={resource.loading} error={resource.error} onRetry={resource.reload}>
        {data && (
          <div className="page-grid">
            <Card>
              <CardHeader>
                <CardTitle>{t('resources.open')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="stack">
                  {data.description && <p>{data.description}</p>}
                  {data.link && (
                    <p>
                      <TextLink href={data.link} target="_blank" rel="noopener noreferrer">
                        {t('resources.openLink')}
                      </TextLink>
                    </p>
                  )}
                  {data.hasFile && (
                    <>
                      <p className="muted">
                        {t('resources.fileInfo', {
                          name: data.fileName,
                          size: megabytes(data.size ?? 0),
                        })}
                      </p>
                      <div className="badge-row">
                        <Button onClick={open} loading={busy === 'open'}>
                          {t('resources.openFile')}
                        </Button>
                        {canSaveOffline() &&
                          (data.saved ? (
                            <Button variant="outline" onClick={remove} loading={busy === 'remove'}>
                              {t('resources.removeSaved')}
                            </Button>
                          ) : (
                            <Button variant="outline" onClick={save} loading={busy === 'save'}>
                              {t('resources.saveOnDevice')}
                            </Button>
                          ))}
                      </div>
                      {canSaveOffline() && <p className="muted">{t('resources.saveHint')}</p>}
                    </>
                  )}
                  {data.link && !data.hasFile && (
                    <Alert tone="info">{t('resources.linkNeedsInternet')}</Alert>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('common.details')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="detail-list">
                  <Detail
                    label={t('resources.tracks')}
                    value={data.tracks.map((tr) => t(`tracks.${tr}`)).join(', ')}
                  />
                  <Detail
                    label={t('resources.ages')}
                    value={data.ageBands.join(', ') || t('resources.allAges')}
                  />
                  <Detail label={t('resources.language')} value={t(`language.${data.language}`)} />
                </dl>
              </CardContent>
            </Card>
          </div>
        )}
      </DataState>
    </>
  );
}
