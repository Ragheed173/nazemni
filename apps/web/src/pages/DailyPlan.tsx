import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, mutations } from '../api';
import { courseName } from '../lib';
import type { Course, DailyPlan, PlanItem } from '../types';
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
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [completed, setCompleted] = useState<string[]>([]);
  const [inProgress, setInProgress] = useState<string[]>([]);
  const [deferred, setDeferred] = useState<string[]>([]);
  const [stoppedAt, setStoppedAt] = useState('');
  const [misunderstood, setMisunderstood] = useState('');
  const [courseId, setCourseId] = useState('');
  const [selfRating, setSelfRating] = useState('');
  const [notes, setNotes] = useState('');
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<Course[]>('/courses'), enabled: open });
  const setTaskStatus = (id: string, status: 'COMPLETED' | 'IN_PROGRESS' | 'DEFERRED', checked: boolean) => {
    setCompleted((current) => current.filter((value) => value !== id));
    setInProgress((current) => current.filter((value) => value !== id));
    setDeferred((current) => current.filter((value) => value !== id));
    if (!checked) return;
    if (status === 'COMPLETED') setCompleted((current) => [...current, id]);
    if (status === 'IN_PROGRESS') setInProgress((current) => [...current, id]);
    if (status === 'DEFERRED') setDeferred((current) => [...current, id]);
  };
  const mutation = useMutation({
    mutationFn: () => {
      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      return mutations.create('/daily-checkouts', {
      date: today.toISOString().slice(0, 10), completedTaskIds: completed, deferredTaskIds: deferred,
      inProgressTaskIds: inProgress, stoppedAt: stoppedAt || undefined,
      misunderstoodTopics: misunderstood.split(/[،,\n]/).map((value) => value.trim()).filter(Boolean),
      courseId: courseId || undefined, selfRating: selfRating ? Number(selfRating) : undefined, notes,
      });
    },
    onSuccess: () => {
      toast.success(t('common.success'));
      void client.invalidateQueries();
      setCompleted([]); setInProgress([]); setDeferred([]); setStoppedAt('');
      setMisunderstood(''); setCourseId(''); setSelfRating(''); setNotes('');
      onClose();
    },
  });
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="checkout-title">{t('plan.checkoutTitle')}</h2>
        <div className="checkout-list">{items.filter((x) => x.kind === 'task').map((item) => (
          <div key={item.id}>
            <span>{item.title}</span>
            <label><input type="checkbox" checked={completed.includes(item.entityId)} onChange={(e) => setTaskStatus(item.entityId, 'COMPLETED', e.target.checked)} />{t('plan.completed')}</label>
            <label><input type="checkbox" checked={inProgress.includes(item.entityId)} onChange={(e) => setTaskStatus(item.entityId, 'IN_PROGRESS', e.target.checked)} />{t('plan.inProgress')}</label>
            <label><input type="checkbox" checked={deferred.includes(item.entityId)} onChange={(e) => setTaskStatus(item.entityId, 'DEFERRED', e.target.checked)} />{t('plan.deferred')}</label>
          </div>
        ))}</div>
        <div className="entity-form">
          <label className="field"><span>{t('plan.stoppedAt')}</span><input value={stoppedAt} onChange={(e) => setStoppedAt(e.target.value)} /></label>
          <label className="field"><span>{t('common.course')}</span><select value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">—</option>{courses.data?.map((course) => <option key={course.id} value={course.id}>{courseName(course, i18n.language)}</option>)}</select></label>
          <label className="field"><span>{t('plan.misunderstood')}</span><input value={misunderstood} onChange={(e) => setMisunderstood(e.target.value)} /></label>
          <label className="field"><span>{t('plan.selfRating')}</span><input type="number" min="1" max="10" value={selfRating} onChange={(e) => setSelfRating(e.target.value)} /></label>
        </div>
        <label className="field"><span>{t('common.notes')}</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="dialog-actions"><button className="button secondary" onClick={onClose}>{t('common.cancel')}</button><button className="button primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{t('common.save')}</button></div>
      </section>
    </div>
  );
}
