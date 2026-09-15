import { useTranslation } from 'react-i18next';

export function LoadingState() {
  const { t } = useTranslation();
  return <div className="state-box" role="status"><span className="spinner" />{t('common.loading')}</div>;
}

export function ErrorState({ retry }: { retry?: () => void }) {
  const { t } = useTranslation();
  return <div className="state-box error-state" role="alert"><p>{t('common.error')}</p>{retry && <button className="button secondary" onClick={retry}>{t('common.retry')}</button>}</div>;
}

export function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation();
  return <div className="empty-state"><p>{message ?? t('common.noData')}</p>{!message && <span>{t('common.emptyHint')}</span>}</div>;
}
