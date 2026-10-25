import { useEffect, useState } from 'react';
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
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  TextLink,
  useToast,
} from 'steamlabsui';
import {
  CONSENT_STATUSES,
  EVENT_MAX_PHOTOS,
  EVENT_PARTICIPANT_STATUSES,
} from '@code-clubs/shared/enums';
import { createEventProjectSchema } from '@code-clubs/shared/schemas';
import { useAuth } from '../../context/AuthContext.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { DataState } from '../../components/DataState.jsx';
import { Detail } from '../../components/Detail.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { extensionFor, saveBlob, shrinkPhoto } from '../../utils/files.js';
import { issuesToFieldErrors } from '../../utils/formErrors.js';
import { listLearners } from '../../services/learnersService.js';
import {
  addEventPhoto,
  createProject,
  deleteEventPhoto,
  downloadEventConsentFile,
  getEvent,
  getEventPhoto,
  listParticipants,
  listProjects,
  registerParticipants,
  setEventConsent,
  setParticipantStatus,
  updateProject,
  uploadEventConsentFile,
} from '../../services/eventsService.js';
import { EventStatusBadge, eventDates } from './EventsPage.jsx';

/** One event: details, the user's participants with event consent, projects and photos (US-22). */
export function EventDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const event = useApi(getEvent, id);
  const data = event.data?.data;
  // Coordinators manage their own regions' events; HQ all (plan section 8).
  const canManage =
    data &&
    !data.offline &&
    can('event:manage') &&
    (user.role !== 'coordinator' || (user.regions ?? []).includes(data.region));

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to="/events">{t('common.back')}</Link>
          </BackLink>
        }
        eyebrow={data && t(`eventTypes.${data.type}`)}
        title={data?.name ?? t('events.title')}
        meta={data && <EventStatusBadge status={data.status} />}
        actions={
          canManage && (
            <Button variant="outline" asChild>
              <Link to={`/events/${id}/edit`}>{t('common.edit')}</Link>
            </Button>
          )
        }
      />
      <DataState loading={event.loading} error={event.error} onRetry={event.reload}>
        {data && (
          <div className="page-grid">
            {data.offline && <Alert tone="info">{t('events.offline')}</Alert>}
            <EventInfo event={data} />
            {can('eventParticipant:manage') && (
              <ParticipantsCard event={data} onChange={event.reload} />
            )}
            {data.offline ? (
              <Alert tone="info">{t('events.needsConnection')}</Alert>
            ) : (
              <>
                <ProjectsCard event={data} />
                <PhotosCard event={data} canDelete={canManage} onChange={event.reload} />
              </>
            )}
          </div>
        )}
      </DataState>
    </>
  );
}

function EventInfo({ event }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('events.about')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="detail-list">
          <Detail label={t('events.dates')} value={eventDates(event)} />
          <Detail label={t('events.venue')} value={event.venue} />
          <Detail
            label={t('events.region')}
            value={event.region ? t(`regions.${event.region}`) : t('events.national')}
          />
          <Detail
            label={t('events.capacity')}
            value={
              event.registered === null
                ? null
                : event.capacity
                  ? t('events.places', { count: event.registered, capacity: event.capacity })
                  : t('events.registered', { count: event.registered })
            }
          />
          <Detail
            label={t('events.registrationCloses')}
            value={
              event.registrationOpen
                ? t('events.registrationOpen', {
                    date: event.registrationCloses ?? event.startDate,
                  })
                : t('events.registrationClosed')
            }
          />
        </dl>
        {event.description && <p>{event.description}</p>}
        <h3>{t('events.clubs')}</h3>
        {event.clubs.length === 0 ? (
          <p className="muted">{t('events.noClubs')}</p>
        ) : (
          <div className="badge-row">
            {event.clubs.map((c) => (
              <TextLink key={c.id} asChild arrow={false}>
                <Link to={`/clubs/${c.id}`}>
                  {c.code} · {c.name}
                </Link>
              </TextLink>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const learnersFor = () => listLearners({ status: 'active', pageSize: 100 });

function ParticipantsCard({ event, onChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { can } = useAuth();
  const participants = useApi(listParticipants, event.id);
  const rows = participants.data?.data ?? [];
  const [registering, setRegistering] = useState(false);
  const [consentFor, setConsentFor] = useState(null);
  const online = !event.offline;

  const refresh = () => {
    participants.reload();
    onChange();
  };

  async function changeStatus(learnerId, status) {
    try {
      await setParticipantStatus(event.id, learnerId, status);
      toast({ title: t('events.statusSaved'), tone: 'success' });
      refresh();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    }
  }

  async function download(row) {
    try {
      const blob = await downloadEventConsentFile(event.id, row.learnerId);
      saveBlob(
        blob,
        `event-consent-${row.learnerNumber ?? row.learnerId}.${extensionFor(blob.type)}`,
      );
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('events.participants')}</CardTitle>
          {online && event.registrationOpen && (
            <Button size="sm" onClick={() => setRegistering(true)}>
              {t('events.register')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="muted">{t('events.participantsHint')}</p>
        {event.consentMissing > 0 && (
          <Alert tone="warning">
            {t('events.consentMissing', { count: event.consentMissing })}
          </Alert>
        )}
        <DataState
          loading={participants.loading}
          error={participants.error}
          isEmpty={rows.length === 0}
          emptyTitle={t('events.noParticipants')}
          onRetry={participants.reload}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('events.learner')}</TableHead>
                <TableHead>{t('events.club')}</TableHead>
                <TableHead>{t('events.status')}</TableHead>
                <TableHead>{t('events.consent')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.learnerId}>
                  <TableCell>
                    <TextLink asChild arrow={false}>
                      <Link to={`/learners/${row.learnerId}`}>{row.name}</Link>
                    </TextLink>
                  </TableCell>
                  <TableCell>{row.clubCode}</TableCell>
                  <TableCell>
                    {online ? (
                      <EnumSelect
                        aria-label={`${t('events.status')}: ${row.name}`}
                        values={EVENT_PARTICIPANT_STATUSES}
                        labelKey="participantStatuses"
                        value={row.status}
                        onChange={(e) => changeStatus(row.learnerId, e.target.value)}
                      />
                    ) : (
                      t(`participantStatuses.${row.status}`)
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="badge-row">
                      <Badge variant={row.consent === 'given' ? 'secondary' : 'primary'}>
                        {t(`consentStatuses.${row.consent}`)}
                      </Badge>
                      {row.hasConsentFile && (
                        <small className="muted">{t('events.formOnFile')}</small>
                      )}
                      {online && (
                        <Button variant="ghost" size="sm" onClick={() => setConsentFor(row)}>
                          {t('events.recordConsent')}
                        </Button>
                      )}
                      {online && row.hasConsentFile && can('consentFile:read') && (
                        <Button variant="ghost" size="sm" onClick={() => download(row)}>
                          {t('events.downloadForm')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataState>
        <p className="muted">{t('events.consentSeparate')}</p>
      </CardContent>
      {registering && (
        <RegisterDialog
          event={event}
          registered={rows}
          onClose={() => setRegistering(false)}
          onDone={() => {
            setRegistering(false);
            refresh();
          }}
        />
      )}
      {consentFor && (
        <EventConsentDialog
          event={event}
          row={consentFor}
          onClose={() => setConsentFor(null)}
          onDone={() => {
            setConsentFor(null);
            refresh();
          }}
        />
      )}
    </Card>
  );
}

function RegisterDialog({ event, registered, onClose, onDone }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const learners = useApi(learnersFor);
  const taken = new Set(registered.filter((r) => r.status !== 'withdrawn').map((r) => r.learnerId));
  const eligible = (learners.data?.data ?? []).filter(
    (l) => event.clubIds.includes(l.clubId) && !taken.has(l.id),
  );
  const [chosen, setChosen] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await registerParticipants(event.id, chosen);
      toast({ title: t('events.registeredDone'), tone: 'success' });
      onDone();
    } catch (err) {
      const names = err.details
        ?.map((d) => d.name)
        .filter(Boolean)
        .join(', ');
      setError(names ? `${err.message}: ${names}` : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('events.register')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} loading={busy} disabled={chosen.length === 0}>
            {t('events.register')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">{t('events.registerHint')}</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <DataState loading={learners.loading} error={learners.error} onRetry={learners.reload}>
          {eligible.length === 0 ? (
            <EmptyState title={t('events.noLearnersToRegister')} />
          ) : (
            <div className="stack">
              {eligible.map((l) => (
                <Checkbox
                  key={l.id}
                  label={`${l.firstName} ${l.lastName}${l.consents?.participation?.status === 'given' ? '' : ` · ${t('learners.noParticipationConsent')}`}`}
                  checked={chosen.includes(l.id)}
                  onChange={(e) =>
                    setChosen((c) =>
                      e.target.checked ? [...c, l.id] : c.filter((x) => x !== l.id),
                    )
                  }
                />
              ))}
            </div>
          )}
        </DataState>
      </div>
    </Dialog>
  );
}

function EventConsentDialog({ event, row, onClose, onDone }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [status, setStatus] = useState(row.consent === 'pending' ? 'given' : row.consent);
  const [signedOn, setSignedOn] = useState(
    row.consentSignedOn ?? new Date().toISOString().slice(0, 10),
  );
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await setEventConsent(event.id, row.learnerId, { status, signedOn });
      if (file) await uploadEventConsentFile(event.id, row.learnerId, file);
      toast({ title: t('events.consentSaved'), tone: 'success' });
      onDone();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t('events.consent')}: ${row.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label={t('consent.status')}>
          <EnumSelect
            values={CONSENT_STATUSES.filter((s) => s !== 'pending')}
            labelKey="consentStatuses"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </Field>
        <Field label={t('events.signedOn')}>
          <Input type="date" value={signedOn} onChange={(e) => setSignedOn(e.target.value)} />
        </Field>
        <Field label={t('events.uploadForm')} hint={t('consent.uploadHint')}>
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

function ProjectsCard({ event }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const projects = useApi(listProjects, event.id);
  const rows = projects.data?.data ?? [];
  const [adding, setAdding] = useState(false);
  const [resultFor, setResultFor] = useState(null);
  const organiser = can('event:manage');

  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('events.projects')}</CardTitle>
          {can('eventParticipant:manage') && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              {t('events.addProject')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DataState
          loading={projects.loading}
          error={projects.error}
          isEmpty={rows.length === 0}
          emptyTitle={t('events.noProjects')}
          onRetry={projects.reload}
        >
          <ul className="alert-list">
            {rows.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>{p.title}</strong>
                  {p.clubCode && <small>{`${p.clubCode} · ${p.clubName}`}</small>}
                  <small>
                    {p.learners.map((l) => l.name).join(', ')}
                    {p.learnerCount > p.learners.length &&
                      ` ${t('events.otherMembers', { count: p.learnerCount - p.learners.length })}`}
                  </small>
                  {p.description && <small>{p.description}</small>}
                  {p.link && (
                    <small>
                      <a href={p.link} target="_blank" rel="noreferrer noopener">
                        {p.link}
                      </a>
                    </small>
                  )}
                </span>
                <span className="badge-row">
                  {p.rank && <Badge variant="secondary">{`${t('events.rank')} ${p.rank}`}</Badge>}
                  {p.award && <Badge variant="primary">{p.award}</Badge>}
                  {organiser && (
                    <Button variant="ghost" size="sm" onClick={() => setResultFor(p)}>
                      {t('events.setResult')}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </DataState>
      </CardContent>
      {adding && (
        <ProjectDialog
          event={event}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            projects.reload();
          }}
        />
      )}
      {resultFor && (
        <ResultDialog
          event={event}
          project={resultFor}
          onClose={() => setResultFor(null)}
          onDone={() => {
            setResultFor(null);
            projects.reload();
          }}
        />
      )}
    </Card>
  );
}

function ProjectDialog({ event, onClose, onDone }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const participants = useApi(listParticipants, event.id);
  const members = (participants.data?.data ?? []).filter((p) => p.status !== 'withdrawn');
  const [values, setValues] = useState({ title: '', description: '', link: '', learnerIds: [] });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const body = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''));
    const parsed = createEventProjectSchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToFieldErrors(t, parsed.error.issues));
    setErrors({});
    setBusy(true);
    try {
      await createProject(event.id, parsed.data);
      toast({ title: t('events.projectAdded'), tone: 'success' });
      onDone();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('events.addProject')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label={t('events.projectTitle')} error={errors.title} required>
          <Input
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
          />
        </Field>
        <Field label={t('events.projectDescription')} error={errors.description}>
          <Textarea
            rows={2}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
          />
        </Field>
        <Field label={t('events.link')} error={errors.link} hint={t('events.linkHint')}>
          <Input
            type="url"
            value={values.link}
            onChange={(e) => setValues({ ...values, link: e.target.value })}
          />
        </Field>
        <Field label={t('events.members')} error={errors.learnerIds} hint={t('events.membersHint')}>
          <div className="stack">
            {members.map((m) => (
              <Checkbox
                key={m.learnerId}
                label={`${m.name} · ${m.clubCode}`}
                checked={values.learnerIds.includes(m.learnerId)}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    learnerIds: e.target.checked
                      ? [...v.learnerIds, m.learnerId]
                      : v.learnerIds.filter((x) => x !== m.learnerId),
                  }))
                }
              />
            ))}
          </div>
        </Field>
      </div>
    </Dialog>
  );
}

function ResultDialog({ event, project, onClose, onDone }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [award, setAward] = useState(project.award ?? '');
  const [rank, setRank] = useState(project.rank ? String(project.rank) : '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateProject(event.id, project.id, {
        ...(award && { award }),
        ...(rank && { rank: Number(rank) }),
      });
      toast({ title: t('events.projectSaved'), tone: 'success' });
      onDone();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t('events.setResult')}: ${project.title}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label={t('events.award')}>
          <Input value={award} maxLength={80} onChange={(e) => setAward(e.target.value)} />
        </Field>
        <Field label={t('events.rank')}>
          <Select value={rank} onChange={(e) => setRank(e.target.value)}>
            <option value="">{t('common.none')}</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

/** Event photos, fetched with the user's token and never cached (D2-7, R4-5). */
function PhotosCard({ event, canDelete, onChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { can } = useAuth();
  const [urls, setUrls] = useState({});
  const [pending, setPending] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const photoKey = event.photoIds.join(',');

  useEffect(() => {
    let cancelled = false;
    const created = [];
    Promise.all(
      event.photoIds.map(async (photoId) => {
        try {
          const url = URL.createObjectURL(await getEventPhoto(event.id, photoId));
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
  }, [event.id, photoKey]);

  async function upload(file, confirmConsent) {
    setBusy(true);
    try {
      await addEventPhoto(event.id, file, confirmConsent);
      toast({ title: t('events.photoAdded'), tone: 'success' });
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
      await deleteEventPhoto(event.id, removing);
      toast({ title: t('events.photoDeleted'), tone: 'success' });
      setRemoving(null);
      onChange();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  const canAdd = can('eventParticipant:manage') && event.photoIds.length < EVENT_MAX_PHOTOS;

  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('events.photos')}</CardTitle>
          {canAdd && (
            <label className="file-button">
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={choose}
                disabled={busy}
                aria-label={t('events.addPhoto')}
              />
              <span>{t('events.addPhoto')}</span>
            </label>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="muted">{t('events.photosHint', { max: EVENT_MAX_PHOTOS })}</p>
        {event.photoIds.length === 0 ? (
          <EmptyState title={t('events.noPhotos')} />
        ) : (
          <div className="photo-grid">
            {event.photoIds.map((photoId, i) => (
              <figure key={photoId}>
                {urls[photoId] && (
                  <img src={urls[photoId]} alt={t('events.photoAlt', { n: i + 1 })} />
                )}
                {canDelete && (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(photoId)}>
                    {t('events.deletePhoto')}
                  </Button>
                )}
              </figure>
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
                {t('events.addPhoto')}
              </Button>
            </>
          }
        >
          <div className="stack">
            <p>{t('events.photoConsentBody')}</p>
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
        title={t('events.deletePhoto')}
        confirmLabel={t('events.deletePhoto')}
        busy={busy}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      >
        {t('events.deletePhotoConfirm')}
      </ConfirmDialog>
    </Card>
  );
}
