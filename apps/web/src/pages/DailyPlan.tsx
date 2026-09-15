import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, mutations } from '../api';
import { courseName } from '../lib';
import type { DailyPlan, PlanItem } from '../types';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { StatusBadge } from '../components/StatusBadge';

export function DailyPlanPage() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['daily-plan'], queryFn: () => api<DailyPlan>('/daily-plan') });
  const [checkout, setCheckout] = useState(false);
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState retry={() => void query.refetch()} />;
  return (
    <div className="page">
      <div className="page-header">
        <div><h1>{t('plan.title')}</h1><p>{t('plan.subtitle')}</p></div>
        <button className="button secondary" onClick={() => setCheckout(true)}>{t('plan.checkout')}</button>
      </div>
      <PlanGroup title={t('plan.critical')} items={query.data.groups.CRITICAL} tone="critical" />
      <PlanGroup title={t('plan.important')} items={query.data.groups.IMPORTANT} tone="important" />
      <PlanGroup title={t('plan.optional')} items={query.data.groups.OPTIONAL} tone="optional" />
      <CheckoutDialog open={checkout} onClose={() => setCheckout(false)} items={[
        ...query.data.groups.CRITICAL, ...query.data.groups.IMPORTANT, ...query.data.groups.OPTIONAL,
      ]} />
    </div>
  );
}

function PlanGroup({ title, items, tone }: { title: string; items: PlanItem[]; tone: string }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => mutations.update('/tasks', id, { status }),
    onSuccess: () => { void client.invalidateQueries(); toast.success(t('common.success')); },
  });
  return (
    <section className={'section plan-group ' + tone}>
      <div className="section-heading"><h2>{title}</h2><span>{items.length}</span></div>
      {items.length ? <div className="plan-table">
        <div className="table-head"><span>{t('common.course')}</span><span>{t('common.title')}</span><span>{t('common.reason')}</span><span>{t('common.actions')}</span></div>
        {items.map((item) => (
          <div className="table-row" key={item.id}>
            <span className="course-cell">{courseName(item.course, i18n.language)}</span>
            <div><strong>{item.title}</strong>{item.estimatedEffort && <small>{item.estimatedEffort} {t('common.minutes')}</small>}</div>
            <span>{item.reasons.join(' · ')}</span>
            <div className="row-actions">
              {item.kind === 'task' ? <>
                <button onClick={() => update.mutate({ id: item.entityId, status: 'COMPLETED' })}>{t('plan.markComplete')}</button>
                <button onClick={() => update.mutate({ id: item.entityId, status: 'DEFERRED' })}>{t('plan.defer')}</button>
              </> : <StatusBadge value={item.level} />}
            </div>
          </div>
        ))}
      </div> : <EmptyState message={t('plan.noTasks')} />}
    </section>
  );
}

function CheckoutDialog({ open, onClose, items }: { open: boolean; onClose: () => void; items: PlanItem[] }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [completed, setCompleted] = useState<string[]>([]);
  const [deferred, setDeferred] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const mutation = useMutation({
    mutationFn: () => mutations.create('/daily-checkouts', {
      date: new Date(), completedTaskIds: completed, deferredTaskIds: deferred,
      inProgressTaskIds: [], misunderstoodTopics: [], notes,
    }),
    onSuccess: () => { toast.success(t('common.success')); void client.invalidateQueries(); onClose(); },
  });
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="checkout-title">{t('plan.checkoutTitle')}</h2>
        <div className="checkout-list">{items.filter((x) => x.kind === 'task').map((item) => (
          <div key={item.id}><span>{item.title}</span><label><input type="checkbox" checked={completed.includes(item.entityId)} onChange={(e) => setCompleted(e.target.checked ? [...completed, item.entityId] : completed.filter((id) => id !== item.entityId))} />{t('plan.completed')}</label><label><input type="checkbox" checked={deferred.includes(item.entityId)} onChange={(e) => setDeferred(e.target.checked ? [...deferred, item.entityId] : deferred.filter((id) => id !== item.entityId))} />{t('plan.deferred')}</label></div>
        ))}</div>
        <label className="field"><span>{t('common.notes')}</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="dialog-actions"><button className="button secondary" onClick={onClose}>{t('common.cancel')}</button><button className="button primary" onClick={() => mutation.mutate()}>{t('common.save')}</button></div>
      </section>
    </div>
  );
}
