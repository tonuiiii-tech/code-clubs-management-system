import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  useToast,
} from 'steamlabsui';
import { TERM_NUMBERS } from '@code-clubs/shared/enums';
import {
  createTermSchema,
  reportRecipientsSchema,
  suggestedTerms,
} from '@code-clubs/shared/schemas';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { ListFooter } from '../../components/ListFooter.jsx';
import { useApi } from '../../utils/useApi.js';
import { issuesToFieldErrors } from '../../utils/formErrors.js';
import {
  getReportRecipients,
  listOutbox,
  saveReportRecipients,
} from '../../services/reportsService.js';
import { createTerm, listTerms, updateTerm } from '../../services/termsService.js';

/** HQ settings: term dates, termly report recipients and the message log (plan sections 5, 7). */
export function SettingsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <div className="page-grid">
        {can('term:manage') && <TermsCard />}
        {can('report:schedule') && <RecipientsCard />}
        {can('report:schedule') && <OutboxCard />}
      </div>
    </>
  );
}

function TermsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const terms = useApi(listTerms);
  const rows = terms.data?.data ?? [];
  const year = new Date().getFullYear();
  const missing = [year, year + 1]
    .flatMap((y) => suggestedTerms(y))
    .filter((s) => !rows.some((r) => r.year === s.year && r.number === s.number));
  const nextYear = missing[0]?.year;
  const [draft, setDraft] = useState({
    year: String(year),
    number: '1',
    startDate: '',
    endDate: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function run(action, message) {
    setBusy(true);
    try {
      await action();
      toast({ title: message, tone: 'success' });
      terms.reload();
      return true;
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e) {
    e.preventDefault();
    const body = { ...draft, year: Number(draft.year), number: Number(draft.number) };
    const parsed = createTermSchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToFieldErrors(t, parsed.error.issues));
    setErrors({});
    if (await run(() => createTerm(parsed.data), t('settings.termAdded'))) {
      setDraft((d) => ({ ...d, startDate: '', endDate: '' }));
    }
  }

  const addSuggested = () =>
    run(async () => {
      for (const term of missing.filter((m) => m.year === nextYear)) await createTerm(term);
    }, t('settings.termAdded'));

  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('settings.terms')}</CardTitle>
          {nextYear && (
            <Button variant="outline" size="sm" onClick={addSuggested} loading={busy}>
              {t('settings.suggest', { year: nextYear })}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="muted">{t('settings.termsHint')}</p>
        <DataState loading={terms.loading} error={terms.error} onRetry={terms.reload}>
          {rows.length === 0 ? (
            <EmptyState title={t('settings.noTerms')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('settings.year')}</TableHead>
                  <TableHead>{t('settings.number')}</TableHead>
                  <TableHead>{t('settings.startDate')}</TableHead>
                  <TableHead>{t('settings.endDate')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((term) => (
                  <TermRow
                    key={`${term.id}-${term.updatedAt}`}
                    term={term}
                    busy={busy}
                    onSave={(changes) =>
                      run(() => updateTerm(term.id, changes), t('settings.termSaved'))
                    }
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </DataState>
        <form onSubmit={add} noValidate className="form-section">
          <div className="form-grid">
            <Field label={t('settings.year')} error={errors.year} required>
              <Input
                type="number"
                value={draft.year}
                onChange={(e) => setDraft({ ...draft, year: e.target.value })}
              />
            </Field>
            <Field label={t('settings.number')} error={errors.number} required>
              <Select
                value={draft.number}
                onChange={(e) => setDraft({ ...draft, number: e.target.value })}
              >
                {TERM_NUMBERS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('settings.startDate')} error={errors.startDate} required>
              <Input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </Field>
            <Field label={t('settings.endDate')} error={errors.endDate} required>
              <Input
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              />
            </Field>
          </div>
          <div className="form-actions">
            <Button type="submit" loading={busy}>
              {t('settings.addTerm')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TermRow({ term, busy, onSave }) {
  const { t } = useTranslation();
  const [dates, setDates] = useState({ startDate: term.startDate, endDate: term.endDate });
  const changed = dates.startDate !== term.startDate || dates.endDate !== term.endDate;
  return (
    <TableRow>
      <TableCell>{term.year}</TableCell>
      <TableCell>{term.number}</TableCell>
      <TableCell>
        <Input
          type="date"
          aria-label={`${t('settings.startDate')} ${term.year}/${term.number}`}
          value={dates.startDate}
          onChange={(e) => setDates({ ...dates, startDate: e.target.value })}
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          aria-label={`${t('settings.endDate')} ${term.year}/${term.number}`}
          value={dates.endDate}
          onChange={(e) => setDates({ ...dates, endDate: e.target.value })}
        />
      </TableCell>
      <TableCell>
        {changed && (
          <Button size="sm" onClick={() => onSave(dates)} loading={busy}>
            {t('common.save')}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function RecipientsCard() {
  const { t } = useTranslation();
  const saved = useApi(getReportRecipients);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.recipients')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="muted">{t('settings.recipientsHint')}</p>
        <DataState loading={saved.loading} error={saved.error} onRetry={saved.reload}>
          {saved.data && <RecipientsForm key={saved.data.data.length} initial={saved.data.data} />}
        </DataState>
      </CardContent>
    </Card>
  );
}

function RecipientsForm({ initial }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [rows, setRows] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const setRow = (i, key, value) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));

  async function save() {
    const parsed = reportRecipientsSchema.safeParse({ recipients: rows });
    if (!parsed.success) return setErrors(issuesToFieldErrors(t, parsed.error.issues));
    setErrors({});
    setBusy(true);
    try {
      await saveReportRecipients(parsed.data.recipients);
      toast({ title: t('settings.recipientsSaved'), tone: 'success' });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {rows.length === 0 && <p className="muted">{t('settings.noRecipients')}</p>}
      {rows.map((row, i) => (
        <div className="form-grid" key={i}>
          <Field label={t('settings.name')} error={errors[`recipients.${i}.name`]}>
            <Input value={row.name} onChange={(e) => setRow(i, 'name', e.target.value)} />
          </Field>
          <Field label={t('settings.email')} error={errors[`recipients.${i}.email`]}>
            <Input
              type="email"
              value={row.email}
              onChange={(e) => setRow(i, 'email', e.target.value)}
            />
          </Field>
          <div className="form-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              {t('settings.remove')}
            </Button>
          </div>
        </div>
      ))}
      <div className="form-actions">
        <Button variant="outline" onClick={() => setRows([...rows, { name: '', email: '' }])}>
          {t('settings.addRecipient')}
        </Button>
        <Button onClick={save} loading={busy}>
          {t('settings.saveRecipients')}
        </Button>
      </div>
    </div>
  );
}

function OutboxCard() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { loading, error, data, reload } = useApi(listOutbox, { page });
  const rows = data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.outbox')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert tone="info">{t('settings.outboxHint')}</Alert>
        <DataState
          loading={loading}
          error={error}
          isEmpty={rows.length === 0}
          emptyTitle={t('settings.noMessages')}
          onRetry={reload}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.when')}</TableHead>
                <TableHead>{t('settings.channel')}</TableHead>
                <TableHead>{t('settings.to')}</TableHead>
                <TableHead>{t('settings.message')}</TableHead>
                <TableHead>{t('settings.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{new Date(m.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{t(`channels.${m.channel}`)}</TableCell>
                  <TableCell>{m.to}</TableCell>
                  <TableCell>
                    {m.subject ?? m.body?.slice(0, 80)}
                    {m.attachments?.length > 0 && (
                      <small className="muted">
                        {' '}
                        · {m.attachments.map((a) => a.name).join(', ')}
                      </small>
                    )}
                  </TableCell>
                  <TableCell>{t(`messageStatuses.${m.status}`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ListFooter result={data} onPageChange={setPage} />
        </DataState>
      </CardContent>
    </Card>
  );
}
