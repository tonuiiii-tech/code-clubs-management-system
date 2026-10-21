import { useTranslation } from 'react-i18next';
import { Button, Dialog } from 'steamlabsui';

/** A yes/no question before an action that changes access or history. */
export function ConfirmDialog({ open, title, children, confirmLabel, busy, onConfirm, onClose }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" loading={busy} onClick={onConfirm}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
