import { Link, useNavigate, useParams } from 'react-router-dom';
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
  Textarea,
  useToast,
} from 'steamlabsui';
import { EQUIPMENT_CONDITIONS, EQUIPMENT_TYPES, REGION_VALUES } from '@code-clubs/shared/enums';
import { createEquipmentSchema, updateEquipmentSchema } from '@code-clubs/shared/schemas';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { useApi } from '../../utils/useApi.js';
import { useForm, withoutEmpty } from '../../utils/useForm.js';
import { createEquipment, getEquipment, updateEquipment } from '../../services/equipmentService.js';

const FIELDS = ['name', 'type', 'serialNumber', 'condition', 'region', 'contents', 'notes'];
const noItem = async () => ({ data: null });

/** Add an item to the register (/equipment/new) or change it (/equipment/:id/edit). */
export function EquipmentFormPage() {
  const { id } = useParams();
  const item = useApi(id ? getEquipment : noItem, id);
  return (
    <DataState loading={item.loading} error={item.error} onRetry={item.reload}>
      <EquipmentForm key={item.data?.data?.id ?? 'new'} item={item.data?.data} />
    </DataState>
  );
}

function EquipmentForm({ item }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const editing = Boolean(item);
  const regions = user.role === 'coordinator' ? (user.regions ?? []) : REGION_VALUES;

  const form = useForm({
    initial: {
      ...Object.fromEntries(FIELDS.map((k) => [k, String(item?.[k] ?? '')])),
      type: item?.type ?? 'laptop',
      condition: item?.condition ?? 'working',
      region: item?.region ?? regions[0] ?? '',
    },
    // An emptied optional field is left as it was.
    toInput: (values) => withoutEmpty(values),
    schema: editing ? updateEquipmentSchema : createEquipmentSchema,
    onSubmit: async (body) => {
      const result = editing ? await updateEquipment(item.id, body) : await createEquipment(body);
      toast({ title: t(editing ? 'equipment.saved' : 'equipment.created'), tone: 'success' });
      navigate(`/equipment/${result.data.id}`);
    },
  });
  const { bind, errors } = form;

  return (
    <>
      <PageHeader
        back={
          <BackLink asChild>
            <Link to={editing ? `/equipment/${item.id}` : '/equipment'}>{t('common.back')}</Link>
          </BackLink>
        }
        title={editing ? t('equipment.edit') : t('equipment.add')}
        description={editing ? `${item.assetTag} · ${item.name}` : t('equipment.addHint')}
      />
      <Card>
        <CardContent className="card-body--top">
          <form onSubmit={form.handleSubmit} noValidate>
            {form.formError && (
              <Alert tone="danger" title={t('common.error')} style={{ marginBottom: '1rem' }}>
                {form.formError.message}
              </Alert>
            )}
            <div className="form-grid">
              <Field label={t('equipment.name')} error={errors.name} required>
                <Input {...bind('name')} autoComplete="off" />
              </Field>
              <Field label={t('equipment.type')} error={errors.type} required>
                <EnumSelect {...bind('type')} values={EQUIPMENT_TYPES} labelKey="equipmentTypes" />
              </Field>
              <Field
                label={t('equipment.serialNumber')}
                error={errors.serialNumber}
                hint={t('equipment.serialHint')}
              >
                <Input {...bind('serialNumber')} autoComplete="off" />
              </Field>
              <Field label={t('equipment.condition')} error={errors.condition} required>
                <EnumSelect
                  {...bind('condition')}
                  values={EQUIPMENT_CONDITIONS}
                  labelKey="equipmentConditions"
                />
              </Field>
              <Field
                label={t('equipment.store')}
                error={errors.region}
                hint={editing && item.clubId ? t('equipment.storeOnLoan') : undefined}
                required
              >
                <EnumSelect
                  {...bind('region')}
                  values={regions}
                  labelKey="regions"
                  disabled={editing && Boolean(item.clubId)}
                />
              </Field>
            </div>
            <Field
              label={t('equipment.contents')}
              error={errors.contents}
              hint={t('equipment.contentsHint')}
              className="form-section"
            >
              <Textarea {...bind('contents')} rows={2} maxLength={500} />
            </Field>
            <Field label={t('equipment.notes')} error={errors.notes} className="form-section">
              <Textarea {...bind('notes')} rows={2} maxLength={1000} />
            </Field>
            <div className="form-actions">
              <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={form.submitting}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
