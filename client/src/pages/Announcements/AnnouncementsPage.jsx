import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
  PageHeader,
  SegmentedControl,
  Textarea,
  useToast,
} from 'steamlabsui';
import {
  ANNOUNCEMENT_MAX_LENGTH,
  MESSAGE_CHANNELS,
  REGION_VALUES,
  ROLE_VALUES,
} from '@code-clubs/shared/enums';
import { createAnnouncementSchema } from '@code-clubs/shared/schemas';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { ListFooter } from '../../components/ListFooter.jsx';
import { useApi } from '../../utils/useApi.js';
import { useClubOptions } from '../../utils/useClubOptions.js';
import { issuesToFieldErrors } from '../../utils/formErrors.js';
import {
  listAnnouncements,
  markAnnouncementRead,
  previewAnnouncement,
  sendAnnouncement,
} from '../../services/announcementsService.js';
import { notifyAnnouncementsChanged } from '../../components/AnnouncementsBell.jsx';

// `refresh` only changes the key so the list is fetched again after sending.
const loadBox = ({ refresh: _r, ...query }) => listAnnouncements(query);

/** Announcements to app users only, never guardians (US-23, US-24, D4-7). */
export function AnnouncementsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [box, setBox] = useState('inbox');
  const [composing, setComposing] = useState(false);
  const [page, setPage] = useState(1);
  const [sentCount, setSentCount] = useState(0);
  const list = useApi(loadBox, { box, page, refresh: sentCount });
  const rows = list.data?.data ?? [];
  const canSend = can('announcement:send');

  return (
    <>
      <PageHeader
        title={t('announcements.title')}
        description={t('announcements.description')}
        actions={
          canSend &&
          !composing && <Button onClick={() => setComposing(true)}>{t('announcements.new')}</Button>
        }
      />
      <div className="page-grid">
        {composing && (
          <Composer
            onClose={() => setComposing(false)}
            onSent={() => {
              setComposing(false);
              setBox('sent');
              setSentCount((n) => n + 1);
            }}
          />
        )}
        {canSend && (
          <SegmentedControl
            aria-label={t('announcements.title')}
            options={[
              { value: 'inbox', label: t('announcements.inbox') },
              { value: 'sent', label: t('announcements.sent') },
            ]}
            value={box}
            onValueChange={(v) => {
              setBox(v);
              setPage(1);
            }}
          />
        )}
        <DataState
          loading={list.loading}
          error={
            list.error?.status === 0 ? { message: t('announcements.offlineSent') } : list.error
          }
          isEmpty={rows.length === 0}
          emptyTitle={t(box === 'sent' ? 'announcements.sentEmpty' : 'announcements.empty')}
          onRetry={list.reload}
        >
          <Card>
            <CardContent className="card-body--top">
              {rows.map((a) =>
                box === 'sent' ? (
                  <SentItem key={a.id} announcement={a} />
                ) : (
                  <InboxItem key={a.id} announcement={a} />
                ),
              )}
              <ListFooter result={list.data} onPageChange={setPage} />
            </CardContent>
          </Card>
        </DataState>
      </div>
    </>
  );
}

const when = (a) => new Date(a.createdAt).toLocaleString();

function InboxItem({ announcement: a }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Kept here rather than reloading the list, which would close the message just opened.
  const [read, setRead] = useState(a.read);

  async function toggle() {
    setOpen((o) => !o);
    if (!read) {
      setRead(true);
      await markAnnouncementRead(a.id).catch(() => {});
      notifyAnnouncementsChanged();
    }
  }

  return (
    <article className="announcement">
      <div className="row-between">
        <button type="button" className="link-button" onClick={toggle} aria-expanded={open}>
          <strong>{a.title}</strong>
        </button>
        {!read && <Badge variant="primary">{t('announcements.unread')}</Badge>}
      </div>
      <small className="muted">
        {t('announcements.from', { name: a.senderName })} · {when(a)}
      </small>
      {open && <p>{a.body}</p>}
    </article>
  );
}

function SentItem({ announcement: a }) {
  const { t } = useTranslation();
  return (
    <article className="announcement">
      <div className="row-between">
        <strong>{a.title}</strong>
        <small>
          {t('announcements.readCount', { read: a.readCount, total: a.recipientCount })}
        </small>
      </div>
      <small className="muted">
        {when(a)} ·{' '}
        {a.channels.length
          ? a.channels.map((c) => t(`channels.${c}`)).join(', ')
          : t('announcements.noSms')}
      </small>
      <p>{a.body}</p>
    </article>
  );
}

function toggle(list, value, on) {
  return on ? [...list, value] : list.filter((v) => v !== value);
}

function Composer({ onClose, onSent }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { clubs } = useClubOptions({ activeOnly: true });
  const regions = user.role === 'coordinator' ? (user.regions ?? []) : REGION_VALUES;
  const [values, setValues] = useState({
    title: '',
    body: '',
    audience: { roles: [], regions: [], clubIds: [] },
    channels: [],
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const setAudience = (key, list) =>
    setValues((v) => ({ ...v, audience: { ...v.audience, [key]: list } }));
  const previewKey = JSON.stringify([values.audience, values.channels]);

  // How many people and messages, shown before sending (R4-3).
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      previewAnnouncement({ audience: values.audience, channels: values.channels })
        .then((res) => !cancelled && setPreview(res.data))
        .catch(() => !cancelled && setPreview(null));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // previewKey stands for the audience and channels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  async function send(e) {
    e.preventDefault();
    setFormError(null);
    const parsed = createAnnouncementSchema.safeParse(values);
    if (!parsed.success) return setErrors(issuesToFieldErrors(t, parsed.error.issues));
    setErrors({});
    setBusy(true);
    try {
      await sendAnnouncement(parsed.data);
      toast({ title: t('announcements.sentDone'), tone: 'success' });
      onSent();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('announcements.new')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={send} noValidate className="stack">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label={t('announcements.titleLabel')} error={errors.title} required>
            <Input
              value={values.title}
              maxLength={120}
              onChange={(e) => setValues({ ...values, title: e.target.value })}
            />
          </Field>
          <Field
            label={t('announcements.body')}
            error={errors.body}
            hint={t('announcements.bodyHint', { max: ANNOUNCEMENT_MAX_LENGTH })}
            required
          >
            <Textarea
              rows={4}
              maxLength={ANNOUNCEMENT_MAX_LENGTH}
              value={values.body}
              onChange={(e) => setValues({ ...values, body: e.target.value })}
            />
          </Field>
          <fieldset className="form-section">
            <legend>{t('announcements.audience')}</legend>
            <Field label={t('announcements.roles')} hint={t('announcements.rolesHint')}>
              <div className="checkbox-grid">
                {ROLE_VALUES.map((r) => (
                  <Checkbox
                    key={r}
                    label={t(`roles.${r}`)}
                    checked={values.audience.roles.includes(r)}
                    onChange={(e) =>
                      setAudience('roles', toggle(values.audience.roles, r, e.target.checked))
                    }
                  />
                ))}
              </div>
            </Field>
            <Field label={t('announcements.regions')} hint={t('announcements.regionsHint')}>
              <div className="checkbox-grid">
                {regions.map((r) => (
                  <Checkbox
                    key={r}
                    label={t(`regions.${r}`)}
                    checked={values.audience.regions.includes(r)}
                    onChange={(e) =>
                      setAudience('regions', toggle(values.audience.regions, r, e.target.checked))
                    }
                  />
                ))}
              </div>
            </Field>
            <Field label={t('announcements.clubs')} hint={t('announcements.clubsHint')}>
              <div className="checkbox-grid">
                {clubs.map((c) => (
                  <Checkbox
                    key={c.id}
                    label={`${c.code} · ${c.name}`}
                    checked={values.audience.clubIds.includes(c.id)}
                    onChange={(e) =>
                      setAudience(
                        'clubIds',
                        toggle(values.audience.clubIds, c.id, e.target.checked),
                      )
                    }
                  />
                ))}
              </div>
            </Field>
          </fieldset>
          <Field label={t('announcements.channels')} hint={t('announcements.channelsHint')}>
            <div className="checkbox-grid">
              {MESSAGE_CHANNELS.map((c) => (
                <Checkbox
                  key={c}
                  label={t(`channels.${c}`)}
                  checked={values.channels.includes(c)}
                  onChange={(e) =>
                    setValues({ ...values, channels: toggle(values.channels, c, e.target.checked) })
                  }
                />
              ))}
            </div>
          </Field>
          {preview && (
            <Alert tone="info">
              {t('announcements.preview', { count: preview.recipients })}
              {preview.messages > 0 &&
                ` ${t('announcements.previewMessages', { count: preview.messages })}`}
            </Alert>
          )}
          <div className="form-actions">
            <Button variant="outline" type="button" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={busy} disabled={preview?.recipients === 0}>
              {t('announcements.send')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
