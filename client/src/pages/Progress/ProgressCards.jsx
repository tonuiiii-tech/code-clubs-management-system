import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  TextLink,
} from 'steamlabsui';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { useApi } from '../../utils/useApi.js';
import { getClubProgress, getLearnerProgress } from '../../services/progressService.js';

/** A learner's attendance, projects and scores (plan section 6). */
export function LearnerProgressCard({ learner }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const progress = useApi(getLearnerProgress, learner.id);
  const data = progress.data?.data;
  const back = `/learners/${learner.id}`;
  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('progress.title')}</CardTitle>
          {can('progress:record') && learner.status === 'active' && (
            <Button variant="outline" size="sm" asChild>
              <Link
                to={`/projects/new?clubId=${learner.clubId}&learnerId=${learner.id}&back=${back}`}
              >
                {t('projects.add')}
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DataState loading={progress.loading} error={progress.error} onRetry={progress.reload}>
          {data && (
            <div className="stack">
              {data.offline && <Alert tone="info">{t('progress.offlineCopy')}</Alert>}
              <div className="stat-grid">
                <Stat label={t('progress.attendanceTerm')} value={rate(t, data.attendance.term)} />
                <Stat
                  label={t('progress.attendanceAll')}
                  value={rate(t, data.attendance.allTime)}
                />
                <Stat label={t('progress.projects')} value={data.projects.length} />
                <Stat
                  label={t('progress.averageScore')}
                  value={data.averageScore === null ? '—' : `${data.averageScore}%`}
                />
              </div>
              <h3>{t('progress.projects')}</h3>
              <ProjectList projects={data.projects} back={back} />
              {data.eventProjects.length > 0 && (
                <>
                  <h3>{t('progress.eventProjects')}</h3>
                  <ul className="alert-list">
                    {data.eventProjects.map((p) => (
                      <li key={p.id}>
                        <span>
                          <strong>{p.title}</strong>
                          <small>
                            <Link to={`/events/${p.eventId}`}>{p.eventName}</Link>
                            {p.award && ` · ${p.award}`}
                          </small>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <h3>{t('progress.results')}</h3>
              {data.results.length === 0 ? (
                <p className="muted">{t('progress.noResults')}</p>
              ) : (
                <ul className="alert-list">
                  {data.results.map((r) => (
                    <li key={r.assessmentId}>
                      <span>
                        <TextLink asChild arrow={false}>
                          <Link to={`/assessments/${r.assessmentId}`}>{r.title}</Link>
                        </TextLink>
                        <small>
                          {r.date} · {r.score} / {r.maxScore} ({r.percent}%)
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}

const rate = (t, a) => (a && a.rate !== null ? `${a.rate}%` : '—');

function Stat({ label, value }) {
  return (
    <div>
      <small className="muted">{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function ProjectList({ projects, back, showMembers = false }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  if (projects.length === 0) return <p className="muted">{t('progress.noProjects')}</p>;
  return (
    <ul className="alert-list">
      {projects.map((p) => (
        <li key={p.id}>
          <span>
            <strong>{p.title}</strong>
            <small>
              {[
                p.date,
                t(`tracks.${p.track}`),
                showMembers && p.learners.map((l) => l.name).join(', '),
              ]
                .filter(Boolean)
                .join(' · ')}
            </small>
            <span className="badge-row">
              {p.link && (
                <TextLink href={p.link} target="_blank" rel="noopener noreferrer">
                  {t('projects.openLink')}
                </TextLink>
              )}
              {p.hasFile && (
                <Badge variant={p.filePending ? 'primary' : 'neutral'}>
                  {t(p.filePending ? 'projects.filePending' : 'projects.hasFile')}
                </Badge>
              )}
              {can('progress:record') && (
                <Link to={`/projects/${p.id}/edit?back=${back}`}>{t('common.edit')}</Link>
              )}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A club's projects per track and its assessments with average scores. */
export function ClubProgressCard({ club }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const progress = useApi(getClubProgress, club.id);
  const data = progress.data?.data;
  const back = `/clubs/${club.id}`;
  const record = can('progress:record') && club.status === 'active';
  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('progress.clubTitle')}</CardTitle>
          {record && (
            <span className="badge-row">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/projects/new?clubId=${club.id}&back=${back}`}>{t('projects.add')}</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/assessments/new?clubId=${club.id}`}>{t('assessments.add')}</Link>
              </Button>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DataState loading={progress.loading} error={progress.error} onRetry={progress.reload}>
          {data && (
            <div className="stack">
              <p className="muted">
                {t('progress.learnersWithProject', {
                  count: data.learnersWithProject,
                  total: data.activeLearners,
                })}
              </p>
              {Object.keys(data.projectsByTrack).length > 0 && (
                <div className="badge-row">
                  {Object.entries(data.projectsByTrack).map(([track, n]) => (
                    <Badge key={track}>
                      {t(`tracks.${track}`)}: {n}
                    </Badge>
                  ))}
                </div>
              )}
              <h3>{t('assessments.title')}</h3>
              {data.assessments.length === 0 ? (
                <EmptyState title={t('assessments.empty')} />
              ) : (
                <ul className="alert-list">
                  {data.assessments.map((a) => (
                    <li key={a.id}>
                      <span>
                        <TextLink asChild arrow={false}>
                          <Link to={`/assessments/${a.id}`}>{a.title}</Link>
                        </TextLink>
                        <small>
                          {[
                            a.date,
                            t(`tracks.${a.track}`),
                            t('assessments.scored', { count: a.scored }),
                            a.averageScore !== null &&
                              t('assessments.average', { value: a.averageScore }),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <h3>{t('progress.recentProjects')}</h3>
              <ProjectList projects={data.projects} back={back} showMembers />
            </div>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
