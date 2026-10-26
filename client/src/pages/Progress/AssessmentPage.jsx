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
  Input,
  PageHeader,
  useToast,
} from 'steamlabsui';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { useApi } from '../../utils/useApi.js';
import { getAssessment, saveScores } from '../../services/progressService.js';

/** Scores for one assessment, entered like attendance: one row per learner (US-30, D5-5). */
export function AssessmentPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { can } = useAuth();
  const assessment = useApi(getAssessment, id);
  const data = assessment.data?.data;

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to={data ? `/clubs/${data.clubId}` : '/'}>{t('common.back')}</Link>
          </BackLink>
        }
        eyebrow={data && `${data.date} · ${t(`tracks.${data.track}`)}`}
        title={data?.title ?? t('assessments.title')}
        meta={
          data &&
          data.averageScore !== null && (
            <Badge variant="secondary">
              {t('assessments.average', { value: data.averageScore })}
            </Badge>
          )
        }
        actions={
          data &&
          can('progress:record') && (
            <Button variant="outline" asChild>
              <Link to={`/assessments/${data.id}/edit`}>{t('common.edit')}</Link>
            </Button>
          )
        }
      />
      <DataState loading={assessment.loading} error={assessment.error} onRetry={assessment.reload}>
        {data && (
          <ScoresCard
            key={data.updatedAt ?? data.id}
            assessment={data}
            canWrite={can('progress:record')}
            onSaved={assessment.reload}
          />
        )}
      </DataState>
    </>
  );
}

function ScoresCard({ assessment, canWrite, onSaved }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [values, setValues] = useState(() =>
    Object.fromEntries(assessment.scores.map((s) => [s.learnerId, s.score ?? ''])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const tooHigh = (v) => v !== '' && Number(v) > assessment.maxScore;
  const invalid = Object.values(values).some(
    (v) => v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0 || tooHigh(v)),
  );

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Only changed scores, so nobody else's are overwritten (D5-5).
      const before = Object.fromEntries(assessment.scores.map((s) => [s.learnerId, s.score]));
      const scores = Object.entries(values)
        .map(([learnerId, v]) => ({ learnerId, score: v === '' ? null : Number(v) }))
        .filter((s) => s.score !== (before[s.learnerId] ?? null));
      await saveScores(assessment.id, scores);
      toast({ title: t('assessments.scoresSaved'), tone: 'success' });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('assessments.scores', { max: assessment.maxScore })}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="stack">
          <p className="muted">{t('assessments.scoresHint')}</p>
          {error && <Alert tone="danger">{error}</Alert>}
          <ul className="attendance-list">
            {assessment.scores.map((s) => (
              <li key={s.learnerId} className="attendance-row">
                <span className="attendance-row__name">
                  <strong>{s.name}</strong>
                  {s.status !== 'active' && <Badge>{t(`learnerStatuses.${s.status}`)}</Badge>}
                </span>
                {canWrite ? (
                  <span className="score-input">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={assessment.maxScore}
                      step="0.5"
                      aria-label={t('assessments.scoreFor', { name: s.name })}
                      aria-invalid={tooHigh(values[s.learnerId]) || undefined}
                      value={values[s.learnerId]}
                      onChange={(e) => setValues((v) => ({ ...v, [s.learnerId]: e.target.value }))}
                    />
                    <span className="muted">/ {assessment.maxScore}</span>
                  </span>
                ) : (
                  <span>{s.score ?? '—'}</span>
                )}
              </li>
            ))}
          </ul>
          {invalid && <Alert tone="danger">{t('apiErrors.scoreAboveMaximum')}</Alert>}
          {canWrite && (
            <div className="form-actions">
              <Button onClick={save} loading={busy} disabled={invalid}>
                {t('assessments.saveScores')}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
