import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Avatar,
  BackLink,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  Field,
  List,
  ListItem,
  PageHeader,
  Select,
  TextLink,
  useToast,
} from 'steamlabsui';
import { ASSIGNMENT_ROLES } from '@code-clubs/shared/enums';
import { useAuth } from '../../context/AuthContext.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { DataState } from '../../components/DataState.jsx';
import { Detail } from '../../components/Detail.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useApi } from '../../utils/useApi.js';
import {
  assignChampion,
  endChampionAssignment,
  getClub,
  listClubChampions,
} from '../../services/clubsService.js';
import { getSchool } from '../../services/schoolsService.js';
import { listUsers } from '../../services/usersService.js';
import { listLearners } from '../../services/learnersService.js';
import { listSessions } from '../../services/sessionsService.js';
import { ConsentBadges } from '../../components/ConsentBadges.jsx';
import { SessionTable } from '../Sessions/SessionsPage.jsx';
import { ClubProgressCard } from '../Progress/ProgressCards.jsx';

export function ClubDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { can } = useAuth();
  const club = useApi(getClub, id);
  const data = club.data?.data;

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to="/clubs">{t('common.back')}</Link>
          </BackLink>
        }
        eyebrow={data?.code}
        title={data?.name ?? t('clubs.title')}
        meta={data && <StatusBadge status={data.status} />}
      />
      <DataState loading={club.loading} error={club.error} onRetry={club.reload}>
        {data && (
          <div className="page-grid">
            <ClubDetails club={data} />
            <ClubChampions club={data} />
            {can('learner:read') && <ClubLearners club={data} />}
            {can('session:read') && <ClubSessions club={data} />}
            {can('progress:read') && <ClubProgressCard club={data} />}
          </div>
        )}
      </DataState>
    </>
  );
}

function ClubDetails({ club }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const school = useApi(getSchool, club.schoolId);
  const schoolName = school.data?.data.name;

  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('common.details')}</CardTitle>
          {can('club:write') && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/clubs/${club.id}/edit`}>{t('common.edit')}</Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <dl className="detail-list">
          <Detail
            label={t('clubs.school')}
            value={
              schoolName && (
                <TextLink asChild arrow={false}>
                  <Link to={`/schools/${club.schoolId}`}>{schoolName}</Link>
                </TextLink>
              )
            }
          />
          <Detail label={t('clubs.venueType')} value={t(`venueTypes.${club.venueType}`)} />
          <Detail label={t('clubs.region')} value={t(`regions.${club.region}`)} />
          <Detail
            label={t('clubs.schedule')}
            value={`${t(`days.${club.meetingDay}`)} ${club.startTime}–${club.endTime}`}
          />
          <Detail label={t('clubs.frequency')} value={t(`frequencies.${club.frequency}`)} />
          <Detail label={t('clubs.track')} value={t(`tracks.${club.mainTrack}`)} />
          <Detail label={t('clubs.capacity')} value={String(club.capacity)} />
        </dl>
      </CardContent>
    </Card>
  );
}

function ClubChampions({ club }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { toast } = useToast();
  const champions = useApi(listClubChampions, club.id);
  const [assigning, setAssigning] = useState(false);
  const [ending, setEnding] = useState(null);
  const [busy, setBusy] = useState(false);
  const canAssign = can('club:assignChampion');
  const rows = champions.data?.data ?? [];

  async function endAssignment() {
    setBusy(true);
    try {
      await endChampionAssignment(club.id, ending.userId);
      toast({ title: t('clubs.ended'), tone: 'success' });
      setEnding(null);
      champions.reload();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('clubs.champions')}</CardTitle>
          {canAssign && (
            <Button size="sm" onClick={() => setAssigning(true)}>
              {t('clubs.assign')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DataState
          loading={champions.loading}
          error={champions.error}
          isEmpty={rows.length === 0}
          emptyTitle={t('clubs.noChampions')}
          onRetry={champions.reload}
        >
          <List>
            {rows.map((a) => (
              <ListItem
                key={a.userId}
                leading={<Avatar name={a.fullName} size={32} />}
                title={a.fullName}
                description={t('clubs.since', { date: a.startDate })}
                trailing={
                  <span className="row-between">
                    <Badge variant={a.role === 'lead' ? 'secondary' : 'outline'}>
                      {t(`assignmentRoles.${a.role}`)}
                    </Badge>
                    {canAssign && (
                      <Button variant="ghost" size="sm" onClick={() => setEnding(a)}>
                        {t('clubs.endAssignment')}
                      </Button>
                    )}
                  </span>
                }
              />
            ))}
          </List>
        </DataState>
      </CardContent>

      {assigning && (
        <AssignChampionDialog
          club={club}
          current={rows}
          onClose={() => setAssigning(false)}
          onAssigned={() => {
            setAssigning(false);
            champions.reload();
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(ending)}
        title={t('clubs.endAssignment')}
        confirmLabel={t('clubs.endAssignment')}
        busy={busy}
        onConfirm={endAssignment}
        onClose={() => setEnding(null)}
      >
        {ending && t('clubs.endConfirm', { name: ending.fullName })}
      </ConfirmDialog>
    </Card>
  );
}

const activeChampions = () => listUsers({ role: 'champion', status: 'active', pageSize: 100 });

function AssignChampionDialog({ club, current, onClose, onAssigned }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const candidates = useApi(activeChampions);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('assistant');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const assignedIds = new Set(current.map((a) => a.userId));
  const options = (candidates.data?.data ?? []).filter((u) => !assignedIds.has(u.id));

  async function submit() {
    if (!userId) {
      setError(t('validation.choose'));
      return;
    }
    setBusy(true);
    try {
      await assignChampion(club.id, userId, { role });
      toast({ title: t('clubs.assigned'), tone: 'success' });
      onAssigned();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('clubs.assignTitle')}
      description={`${club.code} · ${club.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy} disabled={candidates.loading}>
            {t('clubs.assign')}
          </Button>
        </>
      }
    >
      <DataState loading={candidates.loading} error={candidates.error}>
        {options.length === 0 ? (
          <EmptyState title={t('users.empty')} />
        ) : (
          <div className="stack">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label={t('clubs.champion')} required>
              <Select
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setError(null);
                }}
              >
                <option value="">{t('clubs.chooseChampion')}</option>
                {options.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                    {u.championProfile?.safeguarding?.status !== 'cleared' &&
                      ` (${t(`safeguarding.${u.championProfile?.safeguarding?.status ?? 'pending'}`)})`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('clubs.assignmentRole')} required>
              <EnumSelect
                value={role}
                onChange={(e) => setRole(e.target.value)}
                values={ASSIGNMENT_ROLES}
                labelKey="assignmentRoles"
              />
            </Field>
          </div>
        )}
      </DataState>
    </Dialog>
  );
}

const activeLearners = (clubId) => listLearners({ clubId, status: 'active', pageSize: 100 });
const recentSessions = (clubId) => listSessions({ clubId, pageSize: 5 });

/** The club's learners with their consent, so missing consent is visible here (US-09). */
function ClubLearners({ club }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const learners = useApi(activeLearners, club.id);
  const rows = learners.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <div>
            <CardTitle>{t('clubs.learners')}</CardTitle>
            {learners.data && (
              <small className="muted">
                {t('clubs.learnerCount', { count: rows.length, capacity: club.capacity })}
              </small>
            )}
          </div>
          <span className="badge-row">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/learners?clubId=${club.id}`}>{t('sessions.viewAll')}</Link>
            </Button>
            {can('learner:write') && club.status === 'active' && (
              <Button size="sm" asChild>
                <Link to={`/learners/new?clubId=${club.id}`}>{t('learners.add')}</Link>
              </Button>
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <DataState
          loading={learners.loading}
          error={learners.error}
          isEmpty={rows.length === 0}
          emptyTitle={t('clubs.noLearners')}
          onRetry={learners.reload}
        >
          <List>
            {rows.map((l) => (
              <ListItem
                key={l.id}
                title={
                  <TextLink asChild arrow={false}>
                    <Link to={`/learners/${l.id}`}>
                      {l.firstName} {l.lastName}
                    </Link>
                  </TextLink>
                }
                description={`${l.learnerNumber} · ${t(`grades.${l.grade}`)}`}
                trailing={<ConsentBadges consents={l.consents} />}
              />
            ))}
          </List>
        </DataState>
      </CardContent>
    </Card>
  );
}

function ClubSessions({ club }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const sessions = useApi(recentSessions, club.id);
  const rows = sessions.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('sessions.recent')}</CardTitle>
          <span className="badge-row">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/sessions?clubId=${club.id}`}>{t('sessions.viewAll')}</Link>
            </Button>
            {can('session:write') && club.status === 'active' && (
              <Button size="sm" asChild>
                <Link to={`/sessions/new?clubId=${club.id}`}>{t('sessions.add')}</Link>
              </Button>
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <DataState
          loading={sessions.loading}
          error={sessions.error}
          isEmpty={rows.length === 0}
          emptyTitle={t('clubs.noSessions')}
          onRetry={sessions.reload}
        >
          <SessionTable rows={rows} />
        </DataState>
      </CardContent>
    </Card>
  );
}
