import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { displayLectureTitle } from '@nazemni/shared';
import { api } from '../api';
import { courseName, formatDate } from '../lib';
import type { Course, EntityRecord } from '../types';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';

interface WeeklyData {
  weekStart: string;
  metrics: { score: number; completion: number; coverage: number; reviews: number; backlog: number; assessments: number };
  tasks: { completed: number; total: number; deferred: number };
  backlog: EntityRecord[];
  coverage: Array<{ course: Course; sessions: number }>;
  reviews: { completed: number; total: number };
  assignments: EntityRecord[];
  projects: EntityRecord[];
  exams: EntityRecord[];
  weakTopics: EntityRecord[];
  grades: EntityRecord[];
}

export function WeeklyReviewPage() {
  const { t, i18n } = useTranslation();
  const query = useQuery({ queryKey: ['weekly-review'], queryFn: () => api<WeeklyData>('/weekly-review') });
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState retry={() => void query.refetch()} />;
  const data = query.data;
  const metrics = [
    ['completion', data.metrics.completion], ['coverage', data.metrics.coverage],
    ['backlogControl', data.metrics.backlog], ['reviews', data.metrics.reviews],
    ['assessments', data.metrics.assessments],
  ];
  return (
    <div className="page">
      <div className="page-header"><div><h1>{t('weekly.title')}</h1><p>{formatDate(data.weekStart, i18n.language)}</p></div></div>
      <div className="weekly-score">
        <div><span>{t('weekly.score')}</span><strong>{data.metrics.score}<small>/100</small></strong></div>
        <div className="score-breakdown">{metrics.map(([key, value]) => (
          <div key={key}><label><span>{t('weekly.' + key)}</span><b>{value}%</b></label><progress value={Number(value)} max="100" /></div>
        ))}</div>
      </div>
      <div className="weekly-grid">
        <section className="section">
          <div className="section-heading"><h2>{t('weekly.coverage')}</h2></div>
          <div className="compact-list">{data.coverage.map((item) => (
            <div className="list-row" key={item.course.id}><strong>{courseName(item.course, i18n.language)}</strong><span className={item.sessions ? 'success-text' : 'danger-text'}>{t(item.sessions ? 'weekly.covered' : 'weekly.notCovered')}</span></div>
          ))}</div>
        </section>
        <section className="section">
          <div className="section-heading"><h2>{t('weekly.keyRisks')}</h2></div>
          {data.backlog.length ? <ol className="risk-list">{data.backlog.slice(0, 5).map((item) => <li key={item.id}><strong>{displayLectureTitle(String(item.title), t('entities.lectures.backloggedLabel'))}</strong><span>{Array.isArray(item.reasons) ? String(item.reasons[0] ?? '') : ''}</span></li>)}</ol> : <EmptyState message={t('backlog.safe')} />}
        </section>
        <section className="section span-2">
          <div className="section-heading"><h2>{t('dashboard.upcoming')}</h2></div>
          {data.exams.length ? <div className="compact-list">{data.exams.map((exam) => <div className="list-row" key={exam.id}><div><strong>{String(exam.title)}</strong>{exam.course && <span>{courseName(exam.course, i18n.language)}</span>}</div><time>{formatDate(String(exam.date), i18n.language)}</time></div>)}</div> : <EmptyState />}
        </section>
      </div>
    </div>
  );
}
