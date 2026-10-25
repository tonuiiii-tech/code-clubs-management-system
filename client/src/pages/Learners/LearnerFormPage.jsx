import { useState } from 'react';
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
  Textarea,
  useToast,
} from 'steamlabsui';
import {
  GENDERS,
  GRADES,
  GUARDIAN_RELATIONSHIPS,
  LEARNER_MAX_AGE,
  LEARNER_MIN_AGE,
} from '@code-clubs/shared/enums';
import { createLearnerSchema, updateLearnerSchema } from '@code-clubs/shared/schemas';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useClubOptions } from '../../utils/useClubOptions.js';
import { useForm, withoutEmpty } from '../../utils/useForm.js';
import { createLearner, getLearner, updateLearner } from '../../services/learnersService.js';

const EMPTY = {
  clubId: '',
  firstName: '',
  lastName: '',
  age: '',
  gender: '',
  grade: '',
  admissionNumber: '',
  accessibilityNeeds: '',
  guardianName: '',
  relationship: '',
  phone: '',
  altPhone: '',
};

const noLearner = async () => ({ data: null });

/** Register (/learners/new) and edit (/learners/:id/edit). Only the agreed fields (D2-9). */
export function LearnerFormPage() {
  const { id } = useParams();
  const learner = useApi(id ? getLearner : noLearner, id);
  const clubs = useClubOptions({ activeOnly: true });
  return (
    <DataState
      loading={learner.loading || clubs.loading}
      error={learner.error ?? clubs.error}
      onRetry={clubs.reload}
    >
      <LearnerForm
        key={learner.data?.data?.id ?? 'new'}
        learner={learner.data?.data}
        clubs={clubs.clubs}
      />
    </DataState>
  );
}

function LearnerForm({ learner, clubs }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [duplicate, setDuplicate] = useState(null);
  const editing = Boolean(learner);

  const toInput = (values) => {
    const { guardianName, relationship, phone, altPhone, age, clubId, ...rest } = values;
    const input = { ...withoutEmpty(rest), age: age === '' ? undefined : Number(age) };
    if (editing) return withoutEmpty(input);
    const contact = withoutEmpty({ guardianName, relationship, phone, altPhone });
    return withoutEmpty({
      ...input,
      clubId,
      contact: Object.keys(contact).length ? contact : undefined,
      confirmDuplicate: duplicate ? true : undefined,
    });
  };

  const form = useForm({
    initial: editing
      ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, String(learner[k] ?? '')]))
      : { ...EMPTY, clubId: params.get('clubId') ?? '' },
    toInput,
    schema: editing ? updateLearnerSchema : createLearnerSchema,
    onSubmit: async (body) => {
      try {
        const { data } = editing
          ? await updateLearner(learner.id, body)
          : await createLearner(body);
        toast({ title: t(editing ? 'learners.saved' : 'learners.created'), tone: 'success' });
        navigate(`/learners/${data.id}`);
      } catch (err) {
        // A possible duplicate is a warning: show it and let the user save anyway (US-07).
        if (err.code === 'POSSIBLE_DUPLICATE') {
          setDuplicate(err.details?.[0] ?? {});
          return;
        }
        throw err;
      }
    },
  });
  const { bind, errors } = form;
  const contactError = (name) => errors[`contact.${name}`];

  return (
    <>
      <PageHeader
        eyebrow={t('nav.learners')}
        back={
          <BackLink asChild>
            <Link to={editing ? `/learners/${learner.id}` : '/learners'}>{t('common.back')}</Link>
          </BackLink>
        }
        title={editing ? t('learners.edit') : t('learners.add')}
        description={editing ? `${learner.learnerNumber}` : undefined}
      />
      <Card>
        <CardContent className="card-body--top">
          <form onSubmit={form.handleSubmit} noValidate>
            <Alert tone="info" style={{ marginBottom: '1rem' }}>
              {t('learners.privacyNote')}
            </Alert>
            {form.formError && (
              <Alert tone="danger" title={t('common.error')} style={{ marginBottom: '1rem' }}>
                {form.formError.message}
              </Alert>
            )}
            {duplicate && (
              <Alert
                tone="warning"
                title={t('learners.duplicateTitle')}
                style={{ marginBottom: '1rem' }}
              >
                {t('learners.duplicateBody', { number: duplicate.learnerNumber ?? '' })}
              </Alert>
            )}
            <div className="form-grid">
              {!editing && (
                <Field label={t('learners.club')} error={errors.clubId} required>
                  <Select {...bind('clubId')}>
                    <option value="">{t('learners.chooseClub')}</option>
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label={t('learners.firstName')} error={errors.firstName} required>
                <Input {...bind('firstName')} autoComplete="off" />
              </Field>
              <Field label={t('learners.lastName')} error={errors.lastName} required>
                <Input {...bind('lastName')} autoComplete="off" />
              </Field>
              <Field
                label={t('learners.age')}
                error={errors.age}
                hint={t('learners.ageHint', { min: LEARNER_MIN_AGE, max: LEARNER_MAX_AGE })}
                required
              >
                <Input
                  {...bind('age')}
                  type="number"
                  inputMode="numeric"
                  min={LEARNER_MIN_AGE}
                  max={LEARNER_MAX_AGE}
                />
              </Field>
              <Field label={t('learners.gender')} error={errors.gender} required>
                <EnumSelect
                  {...bind('gender')}
                  values={GENDERS}
                  labelKey="genders"
                  placeholder=""
                />
              </Field>
              <Field label={t('learners.grade')} error={errors.grade} required>
                <EnumSelect {...bind('grade')} values={GRADES} labelKey="grades" placeholder="" />
              </Field>
              <Field
                label={t('learners.admissionNumber')}
                error={errors.admissionNumber}
                hint={t('learners.admissionHint')}
              >
                <Input {...bind('admissionNumber')} autoComplete="off" />
              </Field>
              <Field
                label={t('learners.accessibilityNeeds')}
                error={errors.accessibilityNeeds}
                hint={t('learners.accessibilityHint')}
              >
                <Textarea {...bind('accessibilityNeeds')} rows={2} maxLength={200} />
              </Field>
            </div>

            {!editing && (
              <fieldset className="form-section">
                <legend>{t('learners.contact')}</legend>
                <p className="muted">{t('learners.contactHqOnly')}</p>
                <div className="form-grid">
                  <Field label={t('learners.guardianName')} error={contactError('guardianName')}>
                    <Input {...bind('guardianName')} autoComplete="off" />
                  </Field>
                  <Field label={t('learners.relationship')} error={contactError('relationship')}>
                    <EnumSelect
                      {...bind('relationship')}
                      values={GUARDIAN_RELATIONSHIPS}
                      labelKey="relationships"
                      placeholder=""
                    />
                  </Field>
                  <Field
                    label={t('learners.phone')}
                    error={contactError('phone')}
                    hint="+2547XXXXXXXX"
                  >
                    <Input {...bind('phone')} type="tel" autoComplete="off" />
                  </Field>
                  <Field label={t('learners.altPhone')} error={contactError('altPhone')}>
                    <Input {...bind('altPhone')} type="tel" autoComplete="off" />
                  </Field>
                </div>
              </fieldset>
            )}

            <div className="form-actions">
              <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={form.submitting}>
                {duplicate ? t('learners.saveAnyway') : t('common.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
