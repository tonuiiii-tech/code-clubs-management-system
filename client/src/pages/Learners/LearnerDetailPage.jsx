import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  BackLink,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  Field,
  Input,
  PageHeader,
  TextLink,
  useToast,
} from 'steamlabsui';
import { CONSENT_STATUSES, CONSENT_TYPES, GUARDIAN_RELATIONSHIPS } from '@code-clubs/shared/enums';
import { consentSchema, learnerContactSchema } from '@code-clubs/shared/schemas';
import { useAuth } from '../../context/AuthContext.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { ConsentBadges } from '../../components/ConsentBadges.jsx';
import { DataState } from '../../components/DataState.jsx';
import { Detail } from '../../components/Detail.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useForm, withoutEmpty } from '../../utils/useForm.js';
import { extensionFor, saveBlob } from '../../utils/files.js';
import { getClub } from '../../services/clubsService.js';
import {
  downloadConsentFile,
  getLearner,
  getLearnerContact,
  saveLearnerContact,
  setConsent,
  setLearnerStatus,
  uploadConsentFile,
} from '../../services/learnersService.js';
import { LearnerStatusBadge } from './LearnersPage.jsx';

export function LearnerDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const learner = useApi(getLearner, id);
  const data = learner.data?.data;

  return (
    <>
      <PageHeader
        eyebrow={t('nav.learners')}
        back={
          <BackLink asChild>
            <Link to="/learners">{t('common.back')}</Link>
          </BackLink>
        }
        eyebrow={data && (data.learnerNumber ?? t('learners.numberPending'))}
        title={data ? `${data.firstName} ${data.lastName}` : t('learners.title')}
        meta={data && <LearnerStatusBadge status={data.status} />}
      />
      <DataState loading={learner.loading} error={learner.error} onRetry={learner.reload}>
        {data && (
          <div className="page-grid">
            <LearnerDetails learner={data} onChange={learner.reload} />
            <ConsentCard learner={data} onChange={learner.reload} />
            <ContactCard learner={data} onChange={learner.reload} />
          </div>
        )}
      </DataState>
    </>
  );
}

function LearnerDetails({ learner, onChange }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { toast } = useToast();
  const club = useApi(getClub, learner.clubId);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const canWrite = can('learner:write');
  const leaving = learner.status === 'active';

  async function changeStatus() {
    setBusy(true);
    try {
      await setLearnerStatus(learner.id, leaving ? 'left' : 'active');
      toast({ title: t('learners.statusChanged'), tone: 'success' });
      setConfirming(false);
      onChange();
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
          <CardTitle>{t('common.details')}</CardTitle>
          {canWrite && (
            <span className="badge-row">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                {leaving ? t('learners.markLeft') : t('learners.reactivate')}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/learners/${learner.id}/edit`}>{t('common.edit')}</Link>
              </Button>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <dl className="detail-list">
          <Detail
            label={t('learners.club')}
            value={
              club.data && (
                <TextLink asChild arrow={false}>
                  <Link to={`/clubs/${learner.clubId}`}>{club.data.data.name}</Link>
                </TextLink>
              )
            }
          />
          <Detail label={t('learners.age')} value={String(learner.age)} />
          <Detail label={t('learners.gender')} value={t(`genders.${learner.gender}`)} />
          <Detail label={t('learners.grade')} value={t(`grades.${learner.grade}`)} />
          <Detail label={t('learners.admissionNumber')} value={learner.admissionNumber} />
          <Detail label={t('learners.accessibilityNeeds')} value={learner.accessibilityNeeds} />
          <Detail label={t('learners.joined')} value={learner.joinedAt} />
          {learner.leftAt && <Detail label={t('learners.left')} value={learner.leftAt} />}
        </dl>
      </CardContent>
      <ConfirmDialog
        open={confirming}
        title={leaving ? t('learners.markLeft') : t('learners.reactivate')}
        confirmLabel={leaving ? t('learners.markLeft') : t('learners.reactivate')}
        busy={busy}
        onConfirm={changeStatus}
        onClose={() => setConfirming(false)}
      >
        {leaving && t('learners.markLeftConfirm', { name: learner.firstName })}
      </ConfirmDialog>
    </Card>
  );
}

function ConsentCard({ learner, onChange }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);

  async function download(type) {
    try {
      const blob = await downloadConsentFile(learner.id, type);
      saveBlob(blob, `consent-${type}-${learner.learnerNumber}.${extensionFor(blob.type)}`);
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('consent.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="stack">
          {CONSENT_TYPES.map((type) => {
            const consent = learner.consents[type];
            return (
              <div key={type} className="consent-row">
                <div>
                  <ConsentBadges consents={{ [type]: consent }} />
                  <small className="muted">
                    {consent.signedOn && `${t('consent.signedOn')} ${consent.signedOn} · `}
                    {consent.filePending
                      ? t('consent.formPending')
                      : consent.hasFile
                        ? t('consent.formOnFile')
                        : t('consent.noForm')}
                  </small>
                </div>
                <span className="badge-row">
                  {consent.hasFile && !consent.filePending && can('consentFile:read') && (
                    <Button variant="ghost" size="sm" onClick={() => download(type)}>
                      {t('consent.download')}
                    </Button>
                  )}
                  {can('consent:write') && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(type)}>
                      {t('consent.record')}
                    </Button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
      {editing && (
        <ConsentDialog
          learner={learner}
          type={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </Card>
  );
}

function ConsentDialog({ learner, type, onClose, onSaved }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const current = learner.consents[type];
  const [file, setFile] = useState(null);
  const form = useForm({
    initial: {
      status: current.status,
      signedOn: current.signedOn ?? new Date().toISOString().slice(0, 10),
    },
    toInput: withoutEmpty,
    schema: consentSchema,
    onSubmit: async (body) => {
      await setConsent(learner.id, type, body);
      if (file) await uploadConsentFile(learner.id, type, file);
      toast({ title: t('consent.saved'), tone: 'success' });
      onSaved();
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('consent.recordTitle', { type: t(`consent.${type}`) })}
      description={`${learner.firstName} ${learner.lastName}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={form.handleSubmit} loading={form.submitting}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {form.formError && <Alert tone="danger">{form.formError.message}</Alert>}
        <Field label={t('consent.status')} error={form.errors.status} required>
          <EnumSelect
            {...form.bind('status')}
            values={CONSENT_STATUSES}
            labelKey="consentStatuses"
          />
        </Field>
        <Field label={t('consent.signedOn')} error={form.errors.signedOn}>
          <Input {...form.bind('signedOn')} type="date" />
        </Field>
        <Field label={t('consent.upload')} hint={t('consent.uploadHint')}>
          <Input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

/** Guardian contacts: HQ can open them (audited); others can only enter them (D2-1). */
function ContactCard({ learner, onChange }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { toast } = useToast();
  const [contact, setContact] = useState(null);
  const [editing, setEditing] = useState(false);
  const canRead = can('learnerContact:read');

  async function show() {
    try {
      setContact((await getLearnerContact(learner.id)).data);
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('learners.contact')}</CardTitle>
          {can('learnerContact:write') && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {learner.hasContact ? t('learners.replaceContact') : t('learners.enterContact')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {contact ? (
          <dl className="detail-list">
            <Detail label={t('learners.guardianName')} value={contact.guardianName} />
            <Detail
              label={t('learners.relationship')}
              value={t(`relationships.${contact.relationship}`)}
            />
            <Detail label={t('learners.phone')} value={contact.phone} />
            <Detail label={t('learners.altPhone')} value={contact.altPhone} />
          </dl>
        ) : (
          <div className="stack">
            <p>{learner.hasContact ? t('learners.contactOnFile') : t('learners.noContact')}</p>
            {canRead && learner.hasContact ? (
              <div>
                <Button variant="secondary" size="sm" onClick={show}>
                  {t('learners.showContact')}
                </Button>
                <p className="muted">{t('learners.showContactNote')}</p>
              </div>
            ) : (
              !canRead && <p className="muted">{t('learners.contactHqOnly')}</p>
            )}
          </div>
        )}
      </CardContent>
      {editing && (
        <ContactDialog
          learner={learner}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setContact(null);
            onChange();
          }}
        />
      )}
    </Card>
  );
}

function ContactDialog({ learner, onClose, onSaved }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const form = useForm({
    initial: { guardianName: '', relationship: '', phone: '', altPhone: '' },
    toInput: withoutEmpty,
    schema: learnerContactSchema,
    onSubmit: async (body) => {
      await saveLearnerContact(learner.id, body);
      toast({ title: t('learners.contactSaved'), tone: 'success' });
      onSaved();
    },
  });
  const { bind, errors } = form;

  return (
    <Dialog
      open
      onClose={onClose}
      title={learner.hasContact ? t('learners.replaceContact') : t('learners.enterContact')}
      description={`${learner.firstName} ${learner.lastName}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={form.handleSubmit} loading={form.submitting}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Alert tone="info">{t('learners.contactHqOnly')}</Alert>
        {form.formError && <Alert tone="danger">{form.formError.message}</Alert>}
        <Field label={t('learners.guardianName')} error={errors.guardianName} required>
          <Input {...bind('guardianName')} autoComplete="off" />
        </Field>
        <Field label={t('learners.relationship')} error={errors.relationship} required>
          <EnumSelect
            {...bind('relationship')}
            values={GUARDIAN_RELATIONSHIPS}
            labelKey="relationships"
            placeholder=""
          />
        </Field>
        <Field label={t('learners.phone')} error={errors.phone} hint="+2547XXXXXXXX" required>
          <Input {...bind('phone')} type="tel" autoComplete="off" />
        </Field>
        <Field label={t('learners.altPhone')} error={errors.altPhone}>
          <Input {...bind('altPhone')} type="tel" autoComplete="off" />
        </Field>
      </div>
    </Dialog>
  );
}
