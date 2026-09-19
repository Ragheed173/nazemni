import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  confirmLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" onClose={onClose}>
      <form method="dialog">
        <h2>{title ?? t('common.confirmDelete')}</h2>
        <div className="dialog-actions">
          <button className="button secondary" value="cancel">{t('common.cancel')}</button>
          <button className="button danger-button" value="confirm" onClick={onConfirm}>{confirmLabel ?? t('common.yesDelete')}</button>
        </div>
      </form>
    </dialog>
  );
}
