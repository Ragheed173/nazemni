import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, mutations } from '../api';
import { courseName, formatDate } from '../lib';
import type { Course, EntityRecord } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { StatusBadge } from '../components/StatusBadge';

type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'radio';
  required?: boolean;
  options?: string[];
  defaultValue?: string | number | boolean;
  placeholder?: string;
};

export type EntityConfig = {
  resource: string;
  translationKey: string;
  fields: Field[];
  editFields?: Field[];
  titleKey?: string;
  statusKey?: string;
  dateKey?: string;
  progressKey?: string;
};

export const entityConfigs: Record<string, EntityConfig> = {
  lectures: {
    resource: '/lectures', translationKey: 'lectures', titleKey: 'title', statusKey: 'state', dateKey: 'lectureDate',
    fields: [
      { key: 'courseId', label: 'common.course', type: 'select', required: true },
      { key: 'lectureDate', label: 'entities.lectures.lectureDate', type: 'date', required: true },
      { key: 'durationMinutes', label: 'entities.lectures.duration', type: 'number', required: true, placeholder: 'entities.lectures.durationPlaceholder' },
      { key: 'deliveryMode', label: 'entities.lectures.deliveryMode', type: 'radio', required: true, options: ['IN_PERSON', 'ONLINE'], defaultValue: 'IN_PERSON' },
      { key: 'attended', label: 'entities.lectures.attended', type: 'radio', required: true, options: ['true', 'false'], defaultValue: false },
      { key: 'needsReview', label: 'entities.lectures.reviewToggle', type: 'checkbox', defaultValue: false },
      { key: 'notes', label: 'common.notes', type: 'textarea' },
    ],
    editFields: [
      { key: 'state', label: 'entities.lectures.state', type: 'select', options: ['TAKEN_NOT_STUDIED', 'STUDIED', 'NEEDS_REVIEW', 'MASTERED'] },
      { key: 'understandingScore', label: 'entities.lectures.understanding', type: 'number' },
    ],
  },
  tasks: {
    resource: '/tasks', translationKey: 'tasks', titleKey: 'title', statusKey: 'status', dateKey: 'dueAt',
    fields: [
      { key: 'courseId', label: 'common.course', type: 'select', required: true },
      { key: 'title', label: 'common.title', required: true },
      { key: 'description', label: 'entities.tasks.description', type: 'textarea' },
      { key: 'type', label: 'common.type', type: 'select', options: ['LECTURE', 'REVIEW', 'ASSIGNMENT', 'PROJECT', 'EXAM_PREP', 'PRACTICE', 'OTHER'], defaultValue: 'OTHER' },
      { key: 'priority', label: 'entities.tasks.priority', type: 'select', options: ['CRITICAL', 'IMPORTANT', 'OPTIONAL'], defaultValue: 'IMPORTANT' },
      { key: 'status', label: 'common.status', type: 'select', options: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED'], defaultValue: 'TODO' },
      { key: 'dueAt', label: 'entities.tasks.dueAt', type: 'date' },
      { key: 'estimatedEffort', label: 'entities.tasks.effort', type: 'number' },
      { key: 'notes', label: 'common.notes', type: 'textarea' },
    ],
  },
  assignments: {
    resource: '/assignments', translationKey: 'assignments', titleKey: 'title', statusKey: 'status', dateKey: 'officialDeadline', progressKey: 'progress',
    fields: [
      { key: 'courseId', label: 'common.course', type: 'select', required: true },
      { key: 'title', label: 'common.title', required: true },
      { key: 'description', label: 'entities.tasks.description', type: 'textarea' },
      { key: 'officialDeadline', label: 'entities.assignments.officialDeadline', type: 'date', required: true },
      { key: 'internalDeadline', label: 'entities.assignments.internalDeadline', type: 'date' },
      { key: 'weight', label: 'entities.assignments.weight', type: 'number' },
      { key: 'status', label: 'common.status', type: 'select', options: ['NOT_STARTED', 'IN_PROGRESS', 'READY_TO_SUBMIT', 'SUBMITTED', 'GRADED'], defaultValue: 'NOT_STARTED' },
      { key: 'progress', label: 'entities.assignments.progress', type: 'number', defaultValue: 0 },
      { key: 'notes', label: 'common.notes', type: 'textarea' },
    ],
  },
  projects: {
    resource: '/projects', translationKey: 'projects', titleKey: 'name', statusKey: 'status', dateKey: 'officialDeadline', progressKey: 'progress',
    fields: [
      { key: 'courseId', label: 'common.course', type: 'select', required: true },
      { key: 'name', label: 'common.title', required: true },
      { key: 'description', label: 'entities.tasks.description', type: 'textarea' },
      { key: 'startDate', label: 'common.date', type: 'date' },
      { key: 'officialDeadline', label: 'entities.projects.officialDeadline', type: 'date', required: true },
      { key: 'internalDeadline', label: 'entities.projects.internalDeadline', type: 'date' },
      { key: 'weight', label: 'entities.projects.weight', type: 'number' },
      { key: 'status', label: 'common.status', type: 'select', options: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'SUBMITTED'], defaultValue: 'NOT_STARTED' },
      { key: 'progress', label: 'common.progress', type: 'number', defaultValue: 0 },
      { key: 'notes', label: 'common.notes', type: 'textarea' },
      { key: 'addDefaultMilestones', label: 'entities.projects.milestones', type: 'checkbox', defaultValue: true },
    ],
  },
  exams: {
    resource: '/exams', translationKey: 'exams', titleKey: 'title', statusKey: 'preparationStatus', dateKey: 'date',
    fields: [
      { key: 'courseId', label: 'common.course', type: 'select', required: true },
      { key: 'title', label: 'common.title', required: true },
      { key: 'type', label: 'common.type', type: 'select', options: ['QUIZ', 'MIDTERM', 'FINAL'], defaultValue: 'MIDTERM' },
      { key: 'date', label: 'entities.exams.examDate', type: 'date', required: true },
      { key: 'weight', label: 'entities.exams.weight', type: 'number' },
      { key: 'preparationStatus', label: 'entities.exams.preparation', type: 'select', options: ['NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED'], defaultValue: 'NOT_STARTED' },
      { key: 'confidenceLevel', label: 'entities.exams.confidence', type: 'number' },
      { key: 'notes', label: 'common.notes', type: 'textarea' },
    ],
  },
  grades: {
    resource: '/grades', translationKey: 'grades', titleKey: 'title', statusKey: 'assessmentType', dateKey: 'date',
    fields: [
      { key: 'courseId', label: 'common.course', type: 'select', required: true },
      { key: 'title', label: 'common.title', required: true },
      { key: 'assessmentType', label: 'common.type', type: 'select', options: ['QUIZ', 'ASSIGNMENT', 'PROJECT', 'MIDTERM', 'FINAL', 'PARTICIPATION', 'OTHER'], defaultValue: 'QUIZ' },
      { key: 'score', label: 'entities.grades.score', type: 'number', required: true },
      { key: 'maximumScore', label: 'entities.grades.maximum', type: 'number', required: true },
      { key: 'weight', label: 'entities.grades.weight', type: 'number' },
      { key: 'date', label: 'common.date', type: 'date', required: true },
      { key: 'notes', label: 'common.notes', type: 'textarea' },
    ],
  },
  'weak-topics': {
    resource: '/weak-topics', translationKey: 'weakTopics', titleKey: 'topic', statusKey: 'severity',
    fields: [
      { key: 'courseId', label: 'common.course', type: 'select', required: true },
      { key: 'topic', label: 'entities.weakTopics.topic', required: true },
      { key: 'description', label: 'entities.tasks.description', type: 'textarea' },
      { key: 'severity', label: 'entities.weakTopics.severity', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH'], defaultValue: 'MEDIUM' },
      { key: 'notes', label: 'common.notes', type: 'textarea' },
    ],
  },
};

export function EntityPage({ config }: { config: EntityConfig }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const [addOpen, setAddOpen] = useState(search.get('add') === '1');
  const [editRecord, setEditRecord] = useState<EntityRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const courseId = search.get('courseId');
  const query = useQuery({
    queryKey: [config.resource, courseId],
    queryFn: async () => {
      const data = await api<EntityRecord[] | { grades: EntityRecord[] }>(config.resource + (courseId ? '?courseId=' + courseId : ''));
      return Array.isArray(data) ? data : data.grades;
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => mutations.remove(config.resource, id),
    onSuccess: () => { toast.success(t('common.deleted')); void client.invalidateQueries(); setDeleteId(null); },
  });
  const updateMilestone = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => mutations.update('/milestones', id, { status }),
    onSuccess: () => { toast.success(t('common.success')); void client.invalidateQueries(); },
    onError: (error) => toast.error(error.message),
  });
  const title = t('entities.' + config.translationKey + '.title');
  useEffect(() => {
    if (search.get('add') === '1') {
      setAddOpen(true);
      search.delete('add');
      setSearch(search, { replace: true });
    }
  }, [search, setSearch]);
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState retry={() => void query.refetch()} />;
  return (
    <div className="page">
      <div className="page-header">
        <div><h1>{title}</h1></div>
        <button className="button primary" onClick={() => setAddOpen(true)}>{t('entities.' + config.translationKey + '.add')}</button>
      </div>
      {config.translationKey === 'grades' && <p className="notice">{t('entities.grades.incomplete')}</p>}
      <section className="section table-section">
        {query.data.length ? <div className="entity-table">
          <div className="table-head">
            <span>{t('common.title')}</span><span>{t('common.course')}</span>
            <span>{t('common.status')}</span><span>{t('common.date')}</span><span>{t('common.actions')}</span>
          </div>
          {query.data.map((item) => (
            <div className="table-row" key={item.id}>
              <div>
                <strong>{String(item[config.titleKey ?? 'title'])}</strong>
                {config.progressKey && <small>{t('common.progress')}: {Number(item[config.progressKey])}%</small>}
                {config.translationKey === 'grades' && <small>{Number(item.score)}/{Number(item.maximumScore)} · {Math.round(Number(item.score) / Number(item.maximumScore) * 100)}%</small>}
                {config.translationKey === 'lectures' && <small>{Number(item.durationMinutes) || 0} {t('common.minutes')} · {item.deliveryMode === 'ONLINE' ? t('common.online') : t('common.inPerson')} · {item.attended ? t('entities.lectures.attendance.true') : t('entities.lectures.attendance.false')}</small>}
                {config.translationKey === 'projects' && Array.isArray(item.milestones) && item.milestones.length > 0 && (
                  <div className="milestone-list">
                    {item.milestones.map((milestone) => {
                      const row = milestone as { id: string; title: string; status: string };
                      return <button type="button" key={row.id} className={row.status === 'COMPLETED' ? 'complete' : ''} onClick={() => updateMilestone.mutate({ id: row.id, status: row.status === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED' })}>{row.title}</button>;
                    })}
                  </div>
                )}
              </div>
              <span className="course-cell">{item.course ? courseName(item.course, i18n.language) : '—'}</span>
              <StatusBadge value={String(item[config.statusKey ?? 'status'] ?? '')} />
              <time>{config.dateKey && item[config.dateKey] ? formatDate(String(item[config.dateKey]), i18n.language) : '—'}</time>
              <div className="row-actions">
                {config.translationKey === 'tasks' && item.status !== 'COMPLETED' && <button onClick={() => void mutations.update('/tasks', item.id, { status: 'COMPLETED' }).then(() => client.invalidateQueries())}>{t('plan.markComplete')}</button>}
                {config.translationKey === 'weakTopics' && !item.resolved && <button onClick={() => void mutations.update('/weak-topics', item.id, { resolved: true }).then(() => client.invalidateQueries())}>{t('entities.weakTopics.resolve')}</button>}
                <button onClick={() => setEditRecord(item)}>{t('common.edit')}</button>
                <button className="danger-text" onClick={() => setDeleteId(item.id)}>{t('common.delete')}</button>
              </div>
            </div>
          ))}
        </div> : <EmptyState />}
      </section>
      <EntityForm open={addOpen} onClose={() => setAddOpen(false)} config={config} initialCourseId={courseId} />
      <EntityForm open={Boolean(editRecord)} onClose={() => setEditRecord(null)} config={config} initialCourseId={courseId} record={editRecord} />
      <ConfirmDialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && remove.mutate(deleteId)} />
    </div>
  );
}

function EntityForm({ open, onClose, config, initialCourseId, record = null }: { open: boolean; onClose: () => void; config: EntityConfig; initialCourseId: string | null; record?: EntityRecord | null }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const formFields = useMemo(() => record && config.editFields ? [...config.fields, ...config.editFields] : config.fields, [config, record]);
  const defaults = useMemo(() => Object.fromEntries(formFields.map((field) => {
    const recordValue = record?.[field.key];
    const value = recordValue ?? (field.key === 'courseId' && initialCourseId ? initialCourseId : field.defaultValue ?? (field.type === 'checkbox' ? false : ''));
    return [field.key, field.type === 'date' && value ? String(value).slice(0, 10) : value];
  })), [formFields, initialCourseId, record]);
  const [form, setForm] = useState<Record<string, unknown>>(defaults);
  useEffect(() => setForm(defaults), [defaults, open]);
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<Course[]>('/courses'), enabled: open });
  const save = useMutation({
    mutationFn: () => record ? mutations.update(config.resource, record.id, clean(form)) : mutations.create(config.resource, clean(form)),
    onSuccess: () => { toast.success(t('common.success')); void client.invalidateQueries(); setForm(defaults); onClose(); },
    onError: (error) => toast.error(error.message),
  });
  if (!open) return null;
  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate(); };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className={'modal-panel ' + (config.translationKey === 'lectures' ? 'lecture-modal' : '')} role="dialog" aria-modal="true" aria-labelledby="entity-form-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="entity-form-title">{record ? t('common.edit') : config.translationKey === 'lectures' ? t('entities.lectures.backloggedAdd') : t('entities.' + config.translationKey + '.add')}</h2>
        <form onSubmit={submit} className="entity-form">
          {formFields.filter((field) => !record || field.key !== 'addDefaultMilestones').map((field) => (
            <label className={'field ' + (field.type === 'textarea' ? 'full-field' : '')} key={field.key}>
              <span>{t(field.label)}{!field.required && field.type !== 'checkbox' && <small> ({t('common.optional')})</small>}</span>
              {field.key === 'courseId' ? (
                <select required value={String(form[field.key] ?? '')} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}>
                  <option value="">—</option>{courses.data?.map((course) => <option key={course.id} value={course.id}>{courseName(course, i18n.language)}</option>)}
                </select>
              ) : field.type === 'select' ? (
                <select required={field.required} value={String(form[field.key] ?? '')} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}>
                  {field.options?.map((option) => <option key={option} value={option}>{t('states.' + option, { defaultValue: option })}</option>)}
                </select>
              ) : field.type === 'radio' ? (
                <div className="choice-cards" role="radiogroup" aria-label={t(field.label)}>
                  {field.options?.map((option, index) => {
                    const checked = field.key === 'attended' ? String(Boolean(form[field.key])) === option : String(form[field.key] ?? '') === option;
                    const optionKey = field.key === 'deliveryMode' ? 'entities.lectures.deliveryModes.' + option : 'entities.lectures.attendance.' + option;
                    return <label className={'choice-card' + (checked ? ' selected' : '')} key={option}><input type="radio" name={field.key} value={option} required={field.required && index === 0} checked={checked} onChange={() => setForm({ ...form, [field.key]: field.key === 'attended' ? option === 'true' : option })} /><span>{t(optionKey, { defaultValue: option })}</span></label>;
                  })}
                </div>
              ) : field.type === 'textarea' ? (
                <textarea value={String(form[field.key] ?? '')} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />
              ) : field.type === 'checkbox' ? (
                <input type="checkbox" checked={Boolean(form[field.key])} onChange={(e) => setForm({ ...form, [field.key]: e.target.checked })} />
              ) : (
                <input type={field.type ?? 'text'} placeholder={field.placeholder ? t(field.placeholder) : undefined} required={field.required} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? 'any' : undefined} value={String(form[field.key] ?? '')} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />
              )}
            </label>
          ))}
          <div className="dialog-actions full-field"><button type="button" className="button secondary" onClick={onClose}>{t('common.cancel')}</button><button className="button primary" disabled={save.isPending}>{t('common.save')}</button></div>
        </form>
      </section>
    </div>
  );
}

function clean(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== ''));
}
