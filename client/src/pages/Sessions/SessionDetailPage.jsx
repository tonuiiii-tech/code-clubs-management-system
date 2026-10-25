import { useEffect, useMemo, useState } from 'react';
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
  Checkbox,
  Dialog,
  EmptyState,
  PageHeader,
  SegmentedControl,
  TextLink,
  useToast,
} from 'steamlabsui';
import { ATTENDANCE_STATUSES } from '@code-clubs/shared/enums';
import { sessionEditWindowOpen } from '@code-clubs/shared/schemas';
import { useAuth } from '../../context/AuthContext.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { DataState } from '../../components/DataState.jsx';
import { Detail } from '../../components/Detail.jsx';
import { useApi } from '../../utils/useApi.js';
import { SESSION_MAX_PHOTOS, shrinkPhoto } from '../../utils/files.js';
import { getClub } from '../../services/clubsService.js';
import { listLearners } from '../../services/learnersService.js';
import {
  addSessionPhoto,
  deleteSessionPhoto,
  getSession,
  getSessionPhoto,
  removePendingPhoto,
  saveAttendance,
} from '../../services/sessionsService.js';
import { SessionStatusBadge } from './SessionsPage.jsx';

export function SessionDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { can } = useAuth();
  const session = useApi(getSession, id);
  const data = session.data?.data;
  // Champions can change a report for 7 days; coordinators and HQ later too (D2-5).
  const locked = data && !sessionEditWindowOpen(data.date) && !can('session:editLate');
  const canWrite = can('session:write') && !locked;

  return (
    <>
      <PageHeader
        eyebrow={t('nav.sessions')}
        back={
          <BackLink asChild>
            <Link to="/sessions">{t('common.back')}</Link>
          </BackLink>
        }
        eyebrow={t('sessions.report')}
        title={
          data
            ? `${data.date} · ${data.topic ?? t(`sessionStatuses.${data.status}`)}`
            : t('sessions.title')
        }
        meta={data && <SessionStatusBadge status={data.status} />}
      />
      <DataState loading={session.loading} error={session.error} onRetry={session.reload}>
        {data && (
          <div className="page-grid">
            {locked && <Alert tone="info">{t('sessions.locked')}</Alert>}
            <SessionReport session={data} canWrite={canWrite} />
            <AttendanceCard
              key={data.updatedAt}
              session={data}
              canWrite={canWrite}
              onSaved={session.reload}
            />
            <PhotosCard session={data} canWrite={canWrite} onChange={session.reload} />
          </div>
        )}
      </DataState>
    </>
  );
}

function SessionReport({ session, canWrite }) {
  const { t } = useTranslation();
  const club = useApi(getClub, session.clubId);
  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('sessions.report')}</CardTitle>
          {canWrite && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/sessions/${session.id}/edit`}>{t('common.edit')}</Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <dl className="detail-list">
          <Detail
            label={t('sessions.club')}
            value={
              club.data && (
                <TextLink asChild arrow={false}>
                  <Link to={`/clubs/${session.clubId}`}>{club.data.data.name}</Link>
                </TextLink>
              )
            }
          />
          <Detail label={t('sessions.date')} value={session.date} />
          <Detail
            label={t('clubs.schedule')}
            value={session.startTime && `${session.startTime}–${session.endTime}`}
          />
          <Detail label={t('sessions.topic')} value={session.topic} />
          <Detail label={t('sessions.notes')} value={session.notes} />
          {session.status === 'cancelled' && (
            <Detail label={t('sessions.cancellationReason')} value={session.cancellationReason} />
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

const clubLearners = (clubId) => listLearners({ clubId, status: 'active', pageSize: 100 });

/** Attendance in one step from the club's learner list, tablet-first (US-11). */
function AttendanceCard({ session, canWrite, onSaved }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const learners = useApi(clubLearners, session.clubId);
  const [marks, setMarks] = useState(() =>
    Object.fromEntries(session.attendance.map((a) => [a.learnerId, a.status])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Active learners, plus anyone already marked who has since left.
  const active = learners.data?.data ?? [];
  const activeIds = new Set(active.map((l) => l.id));
  const roster = [
    ...active,
    ...session.attendance
      .filter((a) => !activeIds.has(a.learnerId))
      .map((a) => ({ ...a, id: a.learnerId, consents: null })),
  ];
  const held = session.status === 'held';
  const editable = canWrite && held;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const records = Object.entries(marks).map(([learnerId, status]) => ({ learnerId, status }));
      await saveAttendance(session.id, records);
      toast({ title: t('sessions.attendanceSaved'), tone: 'success' });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const options = ATTENDANCE_STATUSES.map((s) => ({
    value: s,
    label: t(`attendanceStatuses.${s}`),
  }));

  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('sessions.attendance')}</CardTitle>
          {editable && roster.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMarks(Object.fromEntries(roster.map((l) => [l.id, 'present'])))}
            >
              {t('sessions.allPresent')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!held && <Alert tone="info">{t('sessions.attendanceHeldOnly')}</Alert>}
        <DataState
          loading={learners.loading}
          error={learners.error}
          isEmpty={roster.length === 0}
          emptyTitle={t('sessions.noLearners')}
          onRetry={learners.reload}
        >
          <div className="stack">
            {error && <Alert tone="danger">{error}</Alert>}
            <ul className="attendance-list">
              {roster.map((l) => {
                const name = `${l.firstName} ${l.lastName}`;
                return (
                  <li key={l.id} className="attendance-row">
                    <span className="attendance-row__name">
                      <strong>{name}</strong>
                      {l.consents && l.consents.participation.status !== 'given' && (
                        <Badge variant="primary">{t('learners.noParticipationConsent')}</Badge>
                      )}
                    </span>
                    {editable ? (
                      <SegmentedControl
                        aria-label={name}
                        options={options}
                        value={marks[l.id] ?? ''}
                        onValueChange={(status) => setMarks((m) => ({ ...m, [l.id]: status }))}
                      />
                    ) : (
                      <span>{marks[l.id] ? t(`attendanceStatuses.${marks[l.id]}`) : '—'}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {editable && (
              <div className="form-actions">
                <Button onClick={save} loading={busy}>
                  {t('sessions.saveAttendance')}
                </Button>
              </div>
            )}
          </div>
        </DataState>
      </CardContent>
    </Card>
  );
}

/** Session photos, fetched with the user's token and never cached (D2-7, R2-2). */
function PhotosCard({ session, canWrite, onChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [urls, setUrls] = useState({});
  const [pending, setPending] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const photoKey = session.photoIds.join(',');

  useEffect(() => {
    let cancelled = false;
    const created = [];
    Promise.all(
      session.photoIds.map(async (photoId) => {
        try {
          const url = URL.createObjectURL(await getSessionPhoto(session.id, photoId));
          created.push(url);
          return [photoId, url];
        } catch {
          return [photoId, null];
        }
      }),
    ).then((entries) => !cancelled && setUrls(Object.fromEntries(entries)));
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
    // photoKey lists the photos; the array itself changes on every load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, photoKey]);

  async function upload(file, confirmConsent) {
    setBusy(true);
    try {
      await addSessionPhoto(session.id, file, confirmConsent);
      toast({ title: t('sessions.photoAdded'), tone: 'success' });
      setPending(null);
      onChange();
    } catch (err) {
      if (err.code === 'PHOTO_CONSENT_MISSING') {
        setConfirmed(false);
        setPending({ file, missing: err.details ?? [] });
      } else {
        toast({ title: t('common.error'), description: err.message, tone: 'danger' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function choose(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await upload(await shrinkPhoto(file), false);
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteSessionPhoto(session.id, removing);
      toast({ title: t('sessions.photoDeleted'), tone: 'success' });
      setRemoving(null);
      onChange();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  // Photos taken offline wait on the device until they upload (D3-8).
  const pendingPhotos = session.pendingPhotos ?? [];
  const canAdd = canWrite && session.photoIds.length + pendingPhotos.length < SESSION_MAX_PHOTOS;

  async function removePending(opId) {
    await removePendingPhoto(opId);
    onChange();
  }

  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('sessions.photos')}</CardTitle>
          {canAdd && (
            <label className="file-button">
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={choose}
                disabled={busy}
                aria-label={t('sessions.addPhoto')}
              />
              <span>{t('sessions.addPhoto')}</span>
            </label>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="muted">{t('sessions.photosHint', { max: SESSION_MAX_PHOTOS })}</p>
        {session.photoIds.length === 0 && pendingPhotos.length === 0 ? (
          <EmptyState title={t('sessions.noPhotos')} />
        ) : (
          <div className="photo-grid">
            {session.photoIds.map((photoId, i) => (
              <figure key={photoId}>
                {urls[photoId] && (
                  <img src={urls[photoId]} alt={t('sessions.photoAlt', { n: i + 1 })} />
                )}
                {canWrite && (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(photoId)}>
                    {t('sessions.deletePhoto')}
                  </Button>
                )}
              </figure>
            ))}
            {pendingPhotos.map((photo) => (
              <PendingPhoto key={photo.id} photo={photo} onRemove={() => removePending(photo.id)} />
            ))}
          </div>
        )}
      </CardContent>

      {pending && (
        <Dialog
          open
          onClose={() => setPending(null)}
          title={t('sessions.photoConsentTitle')}
          footer={
            <>
              <Button variant="outline" onClick={() => setPending(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => upload(pending.file, true)}
                loading={busy}
                disabled={!confirmed}
              >
                {t('sessions.addPhoto')}
              </Button>
            </>
          }
        >
          <div className="stack">
            <p>{t('sessions.photoConsentBody')}</p>
            <ul>
              {pending.missing.map((m) => (
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
      <ConfirmDialog
        open={Boolean(removing)}
        title={t('sessions.deletePhoto')}
        confirmLabel={t('sessions.deletePhoto')}
        busy={busy}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      >
        {t('sessions.deletePhotoConfirm')}
      </ConfirmDialog>
    </Card>
  );
}

/** A photo saved on this device that has not uploaded yet. */
function PendingPhoto({ photo, onRemove }) {
  const { t } = useTranslation();
  const url = useMemo(() => (photo.blob ? URL.createObjectURL(photo.blob) : null), [photo.blob]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  return (
    <figure className="photo-pending">
      {url && <img src={url} alt={t('sessions.photoPending')} />}
      <Badge variant="primary">{t('sessions.photoPending')}</Badge>
      <Button variant="ghost" size="sm" onClick={onRemove}>
        {t('sessions.removePending')}
      </Button>
    </figure>
  );
}
