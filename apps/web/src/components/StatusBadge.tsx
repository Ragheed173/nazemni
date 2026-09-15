import { useTranslation } from 'react-i18next';

export function StatusBadge({ value }: { value?: string | null }) {
  const { t } = useTranslation();
  if (!value) return <span className="muted">—</span>;
  const tone =
    ['AT_RISK', 'CRITICAL', 'HIGH', 'DEFERRED', 'BLOCKED'].includes(value)
      ? 'danger'
      : ['NEEDS_ATTENTION', 'IMPORTANT', 'MEDIUM', 'IN_PROGRESS', 'NEEDS_REVIEW'].includes(value)
        ? 'warning'
        : ['ON_TRACK', 'COMPLETED', 'MASTERED', 'SUBMITTED', 'GRADED', 'READY'].includes(value)
          ? 'success'
          : 'neutral';
  return <span className={'badge ' + tone}>{t('states.' + value, { defaultValue: value })}</span>;
}
