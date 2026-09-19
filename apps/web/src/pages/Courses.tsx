import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { courseName, formatDate } from '../lib';
import type { Course, EntityRecord } from '../types';
import { ErrorState, LoadingState } from '../components/PageState';
import { StatusBadge } from '../components/StatusBadge';

export function CoursesPage() {
  const { t, i18n } = useTranslation();
  const query = useQuery({ queryKey: ['courses'], queryFn: () => api<Course[]>('/courses') });
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState retry={() => void query.refetch()} />;
  return (
    <div className="page">
      <div className="page-header"><div><h1>{t('courses.title')}</h1><p>{t('courses.subtitle', { count: query.data.length, credits: query.data.reduce((sum, course) => sum + course.credits, 0) })}</p></div></div>
      <div className="course-list">
        {query.data.map((course) => (
          <Link className="course-row" to={'/courses/' + course.id} key={course.id}>
            <div className="course-name"><span className="course-code">{course.code}</span><div><strong>{courseName(course, i18n.language)}</strong>{course.retake && <small>{t('courses.retake')} · {course.previousGrade?.toFixed(2)}/4.00</small>}</div></div>
            <div className="course-metric"><span>{t('courses.difficulty')}</span><strong>{course.difficulty}/10</strong></div>
            <div className="course-metric"><span>{t('courses.lectureProgress')}</span><strong>{course.lectureProgress ?? 0}%</strong></div>
            <div className="course-metric"><span>{t('courses.target')}</span><strong>{course.targetGrade}</strong></div>
            <StatusBadge value={course.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

interface CourseDetails extends Course {
  schedule: EntityRecord[];
  lectures: EntityRecord[];
  assignments: EntityRecord[];
  projects: EntityRecord[];
  exams: EntityRecord[];
  grades: EntityRecord[];
  weakTopics: EntityRecord[];
  tasks: EntityRecord[];
}

export function CourseDetailsPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const query = useQuery({ queryKey: ['course', id], queryFn: () => api<CourseDetails>('/courses/' + id) });
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState retry={() => void query.refetch()} />;
  const course = query.data;
  const studied = course.lectures.filter((x) => x.state !== 'TAKEN_NOT_STUDIED').length;
  const tabs = [
    ['lectures', course.lectures.length], ['assignments', course.assignments.length],
    ['projects', course.projects.length], ['exams', course.exams.length],
    ['grades', course.grades.length], ['weakTopics', course.weakTopics.filter((x) => !x.resolved).length],
  ] as const;
  return (
    <div className="page">
      <div className="course-detail-header">
        <Link to="/courses" className="back-link">{t('nav.courses')}</Link>
        <div><span className="course-code">{course.code}</span><h1>{courseName(course, i18n.language)}</h1></div>
        <StatusBadge value={course.status} />
      </div>
      <div className="overview-grid">
        <div><span>{t('courses.difficulty')}</span><strong>{course.difficulty}/10</strong></div>
        <div><span>{t('courses.target')}</span><strong>{course.targetGrade}</strong></div>
        <div><span>{t('courses.lectureProgress')}</span><strong>{studied}/{course.lectures.length}</strong></div>
        <div><span>{t('dashboard.backlog')}</span><strong>{course.lectures.length - studied}</strong></div>
        <div><span>{t('entities.weakTopics.title')}</span><strong>{course.weakTopics.filter((x) => !x.resolved).length}</strong></div>
        <div><span>{t('courses.currentGrade')}</span><strong>{course.gradeStanding?.current != null ? course.gradeStanding.current.toFixed(1) + '%' : '—'}</strong></div>
        <div><span>{t('courses.lastStudy')}</span><strong>{course.lastStudyAt ? formatDate(course.lastStudyAt, i18n.language) : '—'}</strong></div>
      </div>
      {!course.gradeStanding?.complete && <p className="notice">{t('courses.weightsIncomplete')}</p>}
      {course.assessmentComponents.length > 0 && (
        <section className="section assessment-structure">
          <div className="section-heading"><h2>{t('courses.assessmentStructure')}</h2></div>
          <div className="assessment-list">
            {course.assessmentComponents.map((component) => <span key={component.id}>{component.name || t('states.' + component.type, { defaultValue: component.type })}{component.weight != null ? ` · ${component.weight}%` : ''}</span>)}
          </div>
        </section>
      )}
      <section className="section">
        <div className="section-heading"><h2>{t('courses.schedule')}</h2></div>
        <div className="schedule-list">{course.schedule.map((slot) => <div key={slot.id}><time dir="ltr">{String(slot.startsAt)}–{String(slot.endsAt)}</time><span>{dayName(Number(slot.dayOfWeek), i18n.language)}</span><small>{t(slot.isOnline ? 'common.online' : 'common.onCampus')}</small></div>)}</div>
      </section>
      <div className="detail-sections">
        {tabs.map(([key, count]) => (
          <Link className="detail-link" key={key} to={'/' + (key === 'weakTopics' ? 'weak-topics' : key) + '?courseId=' + course.id}>
            <span>{t('nav.' + key)}</span><strong>{count}</strong>
          </Link>
        ))}
      </div>
      <section className="section">
        <div className="section-heading"><h2>{t('courses.history')}</h2></div>
        {course.tasks.length ? <div className="compact-list">{course.tasks.slice(0, 8).map((task) => <div className="list-row" key={task.id}><strong>{String(task.title)}</strong><StatusBadge value={String(task.status)} /></div>)}</div> : <p className="muted">{t('common.noData')}</p>}
      </section>
    </div>
  );
}

const dayName = (day: number, language: string) => {
  const base = new Date('2026-09-13T12:00:00');
  base.setDate(base.getDate() + day);
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-PS' : 'en', { weekday: 'long' }).format(base);
};
