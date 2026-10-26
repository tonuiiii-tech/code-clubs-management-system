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
  useToast,
} from 'steamlabsui';
import {
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_REPORT_CONDITIONS,
  LENDABLE_CONDITIONS,
} from '@code-clubs/shared/enums';
import {
  equipmentRepairSchema,
  lendEquipmentSchema,
  reportEquipmentSchema,
  returnEquipmentSchema,
} from '@code-clubs/shared/schemas';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { Detail } from '../../components/Detail.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useClubOptions } from '../../utils/useClubOptions.js';
import { useForm, withoutEmpty } from '../../utils/useForm.js';
import {
  addRepair,
  getEquipment,
  lendEquipment,
  reportEquipment,
  returnEquipment,
} from '../../services/equipmentService.js';
import { ConditionBadge, Whereabouts } from './EquipmentPage.jsx';

const today = () => new Date().toISOString().slice(0, 10);

/** One item: where it is, its condition and history; lend, return, repair or report it. */
export function EquipmentDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { can } = useAuth();
  const item = useApi(getEquipment, id);
  const data = item.data?.data;
  const [action, setAction] = useState(null);
  const manage = data?.canManage;

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to="/equipment">{t('common.back')}</Link>
          </BackLink>
        }
        eyebrow={data?.assetTag}
        title={data?.name ?? t('equipment.title')}
        meta={data && <ConditionBadge condition={data.condition} />}
        actions={
          data && (
            <div className="badge-row">
              {manage && !data.clubId && LENDABLE_CONDITIONS.includes(data.condition) && (
                <Button onClick={() => setAction('lend')}>{t('equipment.lend')}</Button>
              )}
              {manage && data.clubId && (
                <Button onClick={() => setAction('return')}>{t('equipment.return')}</Button>
              )}
              {manage && (
                <Button variant="outline" onClick={() => setAction('repair')}>
                  {t('equipment.addRepair')}
                </Button>
              )}
              {!manage && can('equipment:report') && data.condition !== 'retired' && (
                <Button variant="outline" onClick={() => setAction('report')}>
                  {t('equipment.report')}
                </Button>
              )}
              {manage && (
                <Button variant="outline" asChild>
                  <Link to={`/equipment/${data.id}/edit`}>{t('common.edit')}</Link>
                </Button>
              )}
            </div>
          )
        }
      />
      <DataState loading={item.loading} error={item.error} onRetry={item.reload}>
        {data && (
          <div className="page-grid">
            {data.offline && <Alert tone="info">{t('equipment.offlineCopy')}</Alert>}
            <Card>
              <CardHeader>
                <CardTitle>{t('common.details')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="detail-list">
                  <Detail label={t('equipment.type')} value={t(`equipmentTypes.${data.type}`)} />
                  <Detail label={t('equipment.serialNumber')} value={data.serialNumber} />
                  <Detail label={t('equipment.where')} value={<Whereabouts item={data} />} />
                  <Detail label={t('equipment.dueDate')} value={data.dueDate} />
                  <Detail label={t('equipment.contents')} value={data.contents} />
                  <Detail label={t('equipment.notes')} value={data.notes} />
                </dl>
              </CardContent>
            </Card>
            {!data.offline && <History item={data} />}
          </div>
        )}
      </DataState>
      {data && action && (
        <ActionDialog
          action={action}
          item={data}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            item.reload();
          }}
        />
      )}
    </>
  );
}

function History({ item }) {
  const { t } = useTranslation();
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('equipment.loans')}</CardTitle>
        </CardHeader>
        <CardContent>
          {item.loans.length === 0 ? (
            <EmptyState title={t('equipment.noLoans')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('equipment.club')}</TableHead>
                  <TableHead>{t('equipment.outDate')}</TableHead>
                  <TableHead>{t('equipment.dueDate')}</TableHead>
                  <TableHead>{t('equipment.returnedDate')}</TableHead>
                  <TableHead>{t('equipment.by')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.club ? `${l.club.code} · ${l.club.name}` : '—'}</TableCell>
                    <TableCell>{l.outDate}</TableCell>
                    <TableCell>{l.dueDate ?? '—'}</TableCell>
                    <TableCell>
                      {l.returnedDate
                        ? `${l.returnedDate} · ${t(`equipmentConditions.${l.conditionReturned}`)}`
                        : t('equipment.stillOut')}
                    </TableCell>
                    <TableCell>
                      {[l.outByName, l.returnedByName].filter(Boolean).join(' / ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('equipment.reportsAndRepairs')}</CardTitle>
        </CardHeader>
        <CardContent>
          {item.reports.length + item.repairs.length === 0 ? (
            <EmptyState title={t('equipment.noReports')} />
          ) : (
            <ul className="alert-list">
              {item.reports.map((r) => (
                <li key={r.id}>
                  <span>
                    <strong>
                      {r.date} ·{' '}
                      {t('equipment.reportedAs', {
                        condition: t(`equipmentConditions.${r.condition}`),
                        name: r.reportedByName,
                      })}
                    </strong>
                    <small>{r.note}</small>
                  </span>
                </li>
              ))}
              {item.repairs.map((r) => (
                <li key={r.id}>
                  <span>
                    <strong>
                      {r.date} · {t('equipment.repaired', { problem: r.problem })}
                    </strong>
                    <small>
                      {[
                        r.action,
                        r.cost !== null &&
                          r.cost !== undefined &&
                          t('equipment.costValue', { cost: r.cost }),
                        t(`equipmentConditions.${r.conditionAfter}`),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

const ACTIONS = {
  lend: {
    schema: lendEquipmentSchema,
    initial: () => ({ clubId: '', outDate: today(), dueDate: '', note: '' }),
    send: (id, body) => lendEquipment(id, body),
  },
  return: {
    schema: returnEquipmentSchema,
    initial: (item) => ({ returnedDate: today(), condition: item.condition, note: '' }),
    send: (id, body) => returnEquipment(id, body),
  },
  repair: {
    schema: equipmentRepairSchema,
    initial: () => ({
      date: today(),
      problem: '',
      action: '',
      cost: '',
      conditionAfter: 'working',
    }),
    toInput: ({ cost, ...values }) => ({
      ...withoutEmpty(values),
      ...(cost !== '' && { cost: Number(cost) }),
    }),
    send: (id, body) => addRepair(id, body),
  },
  report: {
    schema: reportEquipmentSchema,
    initial: () => ({ condition: 'needs_repair', note: '' }),
    send: (id, body) => reportEquipment(id, body),
  },
};

/** Lend, return, repair or report, each a short form in a dialog. */
function ActionDialog({ action, item, onClose, onDone }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { clubs } = useClubOptions({ activeOnly: true });
  const config = ACTIONS[action];
  const form = useForm({
    initial: config.initial(item),
    toInput: config.toInput ?? withoutEmpty,
    schema: config.schema,
    onSubmit: async (body) => {
      await config.send(item.id, body);
      toast({ title: t(`equipment.done.${action}`), tone: 'success' });
      onDone();
    },
  });
  const { bind, errors } = form;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(`equipment.dialog.${action}`)}
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
      <form className="stack" onSubmit={form.handleSubmit} noValidate>
        {form.formError && <Alert tone="danger">{form.formError.message}</Alert>}
        {action === 'lend' && (
          <>
            <Field label={t('equipment.club')} error={errors.clubId} required>
              <Select {...bind('clubId')}>
                <option value="">{t('equipment.chooseClub')}</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('equipment.outDate')} error={errors.outDate} required>
              <Input {...bind('outDate')} type="date" />
            </Field>
            <Field label={t('equipment.dueDate')} error={errors.dueDate}>
              <Input {...bind('dueDate')} type="date" />
            </Field>
          </>
        )}
        {action === 'return' && (
          <>
            <Field label={t('equipment.returnedDate')} error={errors.returnedDate} required>
              <Input {...bind('returnedDate')} type="date" />
            </Field>
            <Field label={t('equipment.conditionNow')} error={errors.condition} required>
              <EnumSelect
                {...bind('condition')}
                values={EQUIPMENT_CONDITIONS}
                labelKey="equipmentConditions"
              />
            </Field>
          </>
        )}
        {action === 'repair' && (
          <>
            <Field label={t('equipment.repairDate')} error={errors.date} required>
              <Input {...bind('date')} type="date" />
            </Field>
            <Field label={t('equipment.problem')} error={errors.problem} required>
              <Input {...bind('problem')} autoComplete="off" />
            </Field>
            <Field label={t('equipment.actionTaken')} error={errors.action}>
              <Input {...bind('action')} autoComplete="off" />
            </Field>
            <Field label={t('equipment.cost')} error={errors.cost}>
              <Input {...bind('cost')} type="number" min="0" />
            </Field>
            <Field label={t('equipment.conditionAfter')} error={errors.conditionAfter} required>
              <EnumSelect
                {...bind('conditionAfter')}
                values={EQUIPMENT_CONDITIONS}
                labelKey="equipmentConditions"
              />
            </Field>
          </>
        )}
        {action === 'report' && (
          <>
            <p className="muted">{t('equipment.reportHint')}</p>
            <Field label={t('equipment.condition')} error={errors.condition} required>
              <EnumSelect
                {...bind('condition')}
                values={EQUIPMENT_REPORT_CONDITIONS}
                labelKey="equipmentConditions"
              />
            </Field>
          </>
        )}
        {action !== 'repair' && (
          <Field label={t('equipment.note')} error={errors.note} required={action === 'report'}>
            <Textarea {...bind('note')} rows={2} maxLength={500} />
          </Field>
        )}
      </form>
    </Dialog>
  );
}
