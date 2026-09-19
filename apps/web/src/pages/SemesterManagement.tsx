import { type FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../api';
import { ErrorState, LoadingState } from '../components/PageState';
import { ConfirmDialog } from '../components/ConfirmDialog';

type CatalogCourse = {
  id: string;
  courseCode: string;
  nameAr: string;
  nameEn: string;
  defaultCredits: number;
  archived: boolean;
};

type ScheduleSlot = {
  id?: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  isOnline: boolean;
  location: string;
};

type AssessmentComponent = {
  id?: string;
  type: 'QUIZ' | 'ASSIGNMENT' | 'PROJECT' | 'MIDTERM' | 'FINAL' | 'PARTICIPATION' | 'OTHER';
  name: string;
  weight: number | null;
  enabled: boolean;
  order: number;
};

type Enrollment = {
  id: string;
  courseId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  credits: number;
  difficulty: number;
  targetGrade: string;
  retake: boolean;
  previousGrade: number | null;
  replacementEffect: boolean;
  instructor: string | null;
  section: string | null;
  notes: string | null;
  enrollmentStatus: 'ACTIVE' | 'DROPPED' | 'WITHDRAWN' | 'COMPLETED';
  schedule: ScheduleSlot[];
  assessmentComponents: AssessmentComponent[];
  _count: Record<string, number>;
};

type Semester = {
  id: string;
  name: string;
  academicYear: string;
  term: string;
  startsAt: string;
  endsAt: string;
  isCurrent: boolean;
};

type ManagementData = { semester: Semester | null; enrollments: Enrollment[]; catalog: CatalogCourse[] };

type EnrollmentDraft = {
  courseId: string;
  createNew: boolean;
  courseCode: string;
  nameAr: string;
  nameEn: string;
  credits: number;
  difficulty: number;
  targetGrade: string;
  retake: boolean;
  previousGrade: number | null;
  replacementEffect: boolean;
  instructor: string;
  section: string;
  notes: string;
  schedule: ScheduleSlot[];
  assessmentComponents: AssessmentComponent[];
};

const assessmentTypes: AssessmentComponent['type'][] = ['QUIZ', 'ASSIGNMENT', 'PROJECT', 'MIDTERM', 'FINAL', 'PARTICIPATION', 'OTHER'];
const emptyDraft = (): EnrollmentDraft => ({
  courseId: '', createNew: false, courseCode: '', nameAr: '', nameEn: '', credits: 3,
  difficulty: 5, targetGrade: 'B', retake: false, previousGrade: null,
  replacementEffect: false, instructor: '', section: '', notes: '', schedule: [], assessmentComponents: [],
});
const withoutId = <T extends { id?: string }>(value: T): Omit<T, 'id'> => {
  const copy = { ...value };
  delete copy.id;
  return copy;
};

export function SemesterManagementPage() {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['semester-management'], queryFn: () => api<ManagementData>('/semester-management') });
  const [editing, setEditing] = useState<Enrollment | 'new' | null>(null);
  const [dropping, setDropping] = useState<Enrollment | null>(null);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['semester-management'] });
    void client.invalidateQueries({ queryKey: ['courses'] });
    void client.invalidateQueries({ queryKey: ['dashboard'] });
    void client.invalidateQueries({ queryKey: ['daily-plan'] });
  };
  const action = useMutation({
    mutationFn: ({ path }: { path: string }) => api(path, { method: 'POST' }),
    onSuccess: () => { toast.success(t('common.success')); setDropping(null); refresh(); },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState retry={() => void query.refetch()} />;
  const { semester, enrollments, catalog } = query.data;
  const active = enrollments.filter((item) => item.enrollmentStatus === 'ACTIVE');
  const inactive = enrollments.filter((item) => item.enrollmentStatus !== 'ACTIVE');
  const credits = active.reduce((sum, item) => sum + item.credits, 0);
  const courseName = (item: Enrollment | CatalogCourse) => i18n.language === 'ar' ? item.nameAr : item.nameEn;

  return (
    <div className="page semester-management">
      <div className="page-header">
        <div><h1>{t('semester.title')}</h1><p>{t('semester.description')}</p></div>
        <button className="button primary" onClick={() => setEditing('new')}>{t('semester.addCourse')}</button>
      </div>
      {semester ? <SemesterEditor semester={semester} onSaved={refresh} /> : <section className="section"><p>{t('semester.noCurrent')}</p></section>}
      <section className="section">
        <div className="section-heading">
          <h2>{t('semester.registeredCourses')}</h2>
          <span className="muted">{active.length} {t('semester.courseCount')} · {credits} {t('semester.creditCount')}</span>
        </div>
        {active.length ? (
          <div className="management-table">
            <div className="table-head">
              <span>{t('common.course')}</span><span>{t('courses.credits')}</span><span>{t('courses.difficulty')}</span>
              <span>{t('courses.target')}</span><span>{t('courses.retake')}</span><span>{t('semester.instructor')}</span><span>{t('common.actions')}</span>
            </div>
            {active.map((item) => (
              <div className="table-row" key={item.id}>
                <div><strong>{courseName(item)}</strong><small dir="ltr">{item.code}{item.section ? ` · ${item.section}` : ''}</small></div>
                <span>{item.credits}</span><span>{item.difficulty}/10</span><span>{item.targetGrade}</span>
                <span>{item.retake ? t('common.yes') : t('common.no')}</span><span>{item.instructor || '—'}</span>
                <div className="row-actions"><button onClick={() => setEditing(item)}>{t('common.edit')}</button><button className="danger-text" onClick={() => setDropping(item)}>{t('semester.drop')}</button></div>
              </div>
            ))}
          </div>
        ) : <p className="muted">{t('semester.noActiveCourses')}</p>}
      </section>
      {inactive.length > 0 && (
        <section className="section">
          <div className="section-heading"><h2>{t('semester.inactiveCourses')}</h2></div>
          <div className="compact-list">
            {inactive.map((item) => <div className="list-row" key={item.id}><div><strong>{courseName(item)}</strong><small dir="ltr">{item.code} · {t(`states.${item.enrollmentStatus}`)}</small></div><button className="button secondary small-button" onClick={() => action.mutate({ path: `/semester-courses/${item.id}/restore` })}>{t('semester.restore')}</button></div>)}
          </div>
        </section>
      )}
      {editing && <EnrollmentForm catalog={catalog} enrollment={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      <ConfirmDialog open={Boolean(dropping)} onClose={() => setDropping(null)} onConfirm={() => dropping && action.mutate({ path: `/semester-courses/${dropping.id}/drop` })} title={t('semester.confirmDrop')} confirmLabel={t('semester.drop')} />
    </div>
  );
}

function SemesterEditor({ semester, onSaved }: { semester: Semester; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ ...semester, startsAt: semester.startsAt.slice(0, 10), endsAt: semester.endsAt.slice(0, 10) });
  const mutation = useMutation({
    mutationFn: () => api(`/semesters/${semester.id}`, { method: 'PATCH', body: JSON.stringify(form) }),
    onSuccess: () => { toast.success(t('common.success')); onSaved(); },
  });
  return (
    <form className="section semester-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <div className="section-heading"><h2>{t('semester.currentSemester')}</h2></div>
      <div className="semester-fields">
        <label className="field"><span>{t('semester.name')}</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label className="field"><span>{t('semester.academicYear')}</span><input dir="ltr" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} required /></label>
        <label className="field"><span>{t('semester.term')}</span><input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} required /></label>
        <label className="field"><span>{t('semester.startDate')}</span><input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required /></label>
        <label className="field"><span>{t('semester.endDate')}</span><input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} required /></label>
      </div>
      <div className="form-actions"><button className="button primary" disabled={mutation.isPending}>{t('common.save')}</button></div>
    </form>
  );
}

function EnrollmentForm({ catalog, enrollment, onClose, onSaved }: { catalog: CatalogCourse[]; enrollment: Enrollment | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<EnrollmentDraft>(emptyDraft());
  useEffect(() => {
    if (!enrollment) { setDraft(emptyDraft()); return; }
    setDraft({
      ...emptyDraft(), courseId: enrollment.courseId, credits: enrollment.credits, difficulty: enrollment.difficulty,
      targetGrade: enrollment.targetGrade, retake: enrollment.retake, previousGrade: enrollment.previousGrade,
      replacementEffect: enrollment.replacementEffect, instructor: enrollment.instructor ?? '', section: enrollment.section ?? '',
      notes: enrollment.notes ?? '', schedule: enrollment.schedule.map((slot) => ({ ...slot, location: slot.location ?? '' })),
      assessmentComponents: enrollment.assessmentComponents,
    });
  }, [enrollment]);
  const mutation = useMutation({
    mutationFn: (payload: unknown) => api(enrollment ? `/semester-courses/${enrollment.id}` : '/semester-courses', { method: enrollment ? 'PATCH' : 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => { toast.success(t('common.success')); onSaved(); },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const base = {
      credits: draft.credits, difficulty: draft.difficulty, targetGrade: draft.targetGrade,
      retake: draft.retake, previousGrade: draft.retake ? draft.previousGrade : null,
      replacementEffect: draft.retake && draft.replacementEffect, instructor: draft.instructor || null,
      section: draft.section || null, notes: draft.notes || null,
      schedule: draft.schedule.map(withoutId),
      assessmentComponents: draft.assessmentComponents.map((component, order) => ({ ...withoutId(component), order })),
    };
    if (enrollment) mutation.mutate(base);
    else mutation.mutate({
      ...base,
      ...(draft.createNew ? { newCourse: { courseCode: draft.courseCode, nameAr: draft.nameAr, nameEn: draft.nameEn, defaultCredits: draft.credits } } : { courseId: draft.courseId }),
    });
  };
  const addSchedule = () => setDraft({ ...draft, schedule: [...draft.schedule, { dayOfWeek: 0, startsAt: '09:00', endsAt: '10:00', isOnline: false, location: '' }] });
  const addAssessment = () => setDraft({ ...draft, assessmentComponents: [...draft.assessmentComponents, { type: 'QUIZ', name: '', weight: null, enabled: true, order: draft.assessmentComponents.length }] });
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-panel enrollment-modal" role="dialog" aria-modal="true" aria-label={enrollment ? t('semester.editEnrollment') : t('semester.addCourse')}>
        <h2>{enrollment ? t('semester.editEnrollment') : t('semester.addCourse')}</h2>
        <form onSubmit={submit}>
          {!enrollment && <div className="choice-row"><label><input type="radio" checked={!draft.createNew} onChange={() => setDraft({ ...draft, createNew: false })} /> {t('semester.existingCourse')}</label><label><input type="radio" checked={draft.createNew} onChange={() => setDraft({ ...draft, createNew: true })} /> {t('semester.newCourse')}</label></div>}
          {!enrollment && !draft.createNew && <label className="field"><span>{t('common.course')}</span><select required value={draft.courseId} onChange={(e) => { const selected = catalog.find((course) => course.id === e.target.value); setDraft({ ...draft, courseId: e.target.value, credits: selected?.defaultCredits ?? draft.credits }); }}><option value="">—</option>{catalog.filter((course) => !course.archived).map((course) => <option key={course.id} value={course.id}>{course.courseCode} — {course.nameEn}</option>)}</select></label>}
          {!enrollment && draft.createNew && <div className="entity-form"><label className="field"><span>{t('semester.courseCode')}</span><input dir="ltr" required value={draft.courseCode} onChange={(e) => setDraft({ ...draft, courseCode: e.target.value })} /></label><label className="field"><span>{t('semester.nameEn')}</span><input dir="ltr" required value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} /></label><label className="field full-field"><span>{t('semester.nameAr')}</span><input dir="rtl" required value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} /></label></div>}
          <div className="entity-form">
            <NumberField label={t('courses.credits')} value={draft.credits} min={1} max={30} onChange={(credits) => setDraft({ ...draft, credits })} />
            <NumberField label={t('courses.difficulty')} value={draft.difficulty} min={1} max={10} onChange={(difficulty) => setDraft({ ...draft, difficulty })} />
            <label className="field"><span>{t('courses.target')}</span><select value={draft.targetGrade} onChange={(e) => setDraft({ ...draft, targetGrade: e.target.value })}><option>B</option><option>B+</option><option>A-</option><option>A</option></select></label>
            <label className="field"><span>{t('semester.instructor')}</span><input value={draft.instructor} onChange={(e) => setDraft({ ...draft, instructor: e.target.value })} /></label>
            <label className="field"><span>{t('semester.section')}</span><input value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} /></label>
            <label className="field checkbox-field"><span>{t('courses.retake')}</span><input type="checkbox" checked={draft.retake} onChange={(e) => setDraft({ ...draft, retake: e.target.checked })} /></label>
            {draft.retake && <><label className="field"><span>{t('semester.previousGrade')}</span><input type="number" min="0" max="4" step="0.01" value={draft.previousGrade ?? ''} onChange={(e) => setDraft({ ...draft, previousGrade: e.target.value ? Number(e.target.value) : null })} /></label><label className="field checkbox-field"><span>{t('semester.replacementEffect')}</span><input type="checkbox" checked={draft.replacementEffect} onChange={(e) => setDraft({ ...draft, replacementEffect: e.target.checked })} /></label></>}
            <label className="field full-field"><span>{t('common.notes')}</span><textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
          </div>
          <EditableSchedule value={draft.schedule} onChange={(schedule) => setDraft({ ...draft, schedule })} onAdd={addSchedule} />
          <EditableAssessments value={draft.assessmentComponents} onChange={(assessmentComponents) => setDraft({ ...draft, assessmentComponents })} onAdd={addAssessment} />
          {mutation.isError && <p className="form-error">{mutation.error.message}</p>}
          <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>{t('common.cancel')}</button><button className="button primary" disabled={mutation.isPending}>{t('common.save')}</button></div>
        </form>
      </div>
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="field"><span>{label}</span><input type="number" required min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

function EditableSchedule({ value, onChange, onAdd }: { value: ScheduleSlot[]; onChange: (value: ScheduleSlot[]) => void; onAdd: () => void }) {
  const { t } = useTranslation();
  const update = (index: number, slot: ScheduleSlot) => onChange(value.map((item, itemIndex) => itemIndex === index ? slot : item));
  return <div className="form-block"><div className="section-heading"><h3>{t('courses.schedule')}</h3><button type="button" className="text-button" onClick={onAdd}>{t('semester.addSchedule')}</button></div>{value.map((slot, index) => <div className="repeat-row schedule-editor" key={index}><select aria-label={t('semester.day')} value={slot.dayOfWeek} onChange={(e) => update(index, { ...slot, dayOfWeek: Number(e.target.value) })}>{[0,1,2,3,4,5,6].map((day) => <option key={day} value={day}>{t(`semester.days.${day}`)}</option>)}</select><input aria-label={t('semester.startTime')} type="time" value={slot.startsAt} onChange={(e) => update(index, { ...slot, startsAt: e.target.value })} /><input aria-label={t('semester.endTime')} type="time" value={slot.endsAt} onChange={(e) => update(index, { ...slot, endsAt: e.target.value })} /><label className="inline-check"><input type="checkbox" checked={slot.isOnline} onChange={(e) => update(index, { ...slot, isOnline: e.target.checked })} /> {t('common.online')}</label><input aria-label={t('semester.room')} placeholder={t('semester.room')} value={slot.location} onChange={(e) => update(index, { ...slot, location: e.target.value })} /><button type="button" className="text-button danger-text" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>{t('common.delete')}</button></div>)}</div>;
}

function EditableAssessments({ value, onChange, onAdd }: { value: AssessmentComponent[]; onChange: (value: AssessmentComponent[]) => void; onAdd: () => void }) {
  const { t } = useTranslation();
  const update = (index: number, component: AssessmentComponent) => onChange(value.map((item, itemIndex) => itemIndex === index ? component : item));
  return <div className="form-block"><div className="section-heading"><h3>{t('courses.assessmentStructure')}</h3><button type="button" className="text-button" onClick={onAdd}>{t('semester.addAssessment')}</button></div>{value.map((component, index) => <div className="repeat-row assessment-editor" key={index}><select aria-label={t('common.type')} value={component.type} onChange={(e) => update(index, { ...component, type: e.target.value as AssessmentComponent['type'] })}>{assessmentTypes.map((type) => <option key={type} value={type}>{t(`states.${type}`)}</option>)}</select><input aria-label={t('common.title')} required placeholder={t('semester.assessmentName')} value={component.name} onChange={(e) => update(index, { ...component, name: e.target.value })} /><input aria-label={t('semester.weight')} type="number" min="0" max="100" placeholder="%" value={component.weight ?? ''} onChange={(e) => update(index, { ...component, weight: e.target.value ? Number(e.target.value) : null })} /><label className="inline-check"><input type="checkbox" checked={component.enabled} onChange={(e) => update(index, { ...component, enabled: e.target.checked })} /> {t('semester.enabled')}</label><button type="button" className="text-button danger-text" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>{t('common.delete')}</button></div>)}</div>;
}
