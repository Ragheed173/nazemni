import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { courseName, formatDate } from '../lib';
import type { Course, DailyPlan, PlanItem } from '../types';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardData {
  hasCurrentSemester: boolean;
  plan: DailyPlan;
  upcoming: Array<{ kind: string; title: string; date: string; course: Course }>;
  attention: Course[];
  backlog: Array<{ id: string; title: string; reasons: string[]; course: Course }>;
  focus: { active: boolean; reason: string | null };
  schedule: Array<{ id: string; startsAt: string; endsAt: string; isOnline: boolean; course: Course }>;
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api<DashboardData>('/dashboard') });
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState retry={() => void query.refetch()} />;
  if (!query.data.hasCurrentSemester) return <div className="page"><div className="page-header"><div><h1>{t('dashboard.title')}</h1></div></div><section className="section empty-workspace"><h2>{t('dashboard.noSemester')}</h2><p>{t('dashboard.noSemesterHint')}</p><Link className="button primary" to="/onboarding">{t('dashboard.createSemester')}</Link></section></div>;
  const tasks = [...query.data.plan.groups.CRITICAL, ...query.data.plan.groups.IMPORTANT].slice(0, 4);
  return (
    <div className="page">
      <div className="page-header">
        <div><h1>{t('dashboard.title')}</h1><p>{new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-PS' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p></div>
        <Link className="button primary" to="/tasks?add=1">{t('entities.tasks.add')}</Link>
      </div>
      {query.data.focus.active && (
        <div className="focus-strip">
          <strong>{t('dashboard.focusActive')}</strong>
          <span>{query.data.focus.reason}</span>
        </div>
      )}
      <div className="dashboard-grid">
        <section className="section span-2">
          <div className="section-heading"><h2>{t('dashboard.todayPlan')}</h2><Link to="/plan">{t('common.view')}</Link></div>
          {tasks.length ? <div className="compact-list">{tasks.map((item) => <PlanRow key={item.id} item={item} />)}</div> : <EmptyState message={t('dashboard.planEmpty')} />}
        </section>
        <section className="section">
          <div className="section-heading"><h2>{t('dashboard.schedule')}</h2></div>
          {query.data.schedule.length ? <div className="schedule-list">{query.data.schedule.map((slot) => (
            <div key={slot.id}><time dir="ltr">{slot.startsAt}–{slot.endsAt}</time><span>{courseName(slot.course, i18n.language)}</span><small>{t(slot.isOnline ? 'common.online' : 'common.onCampus')}</small></div>
          ))}</div> : <EmptyState />}
        </section>
        <section className="section">
          <div className="section-heading"><h2>{t('dashboard.upcoming')}</h2></div>
          {query.data.upcoming.length ? <div className="compact-list">{query.data.upcoming.map((item) => (
            <div className="list-row" key={item.kind + item.title}>
              <div><strong>{item.title}</strong><span>{courseName(item.course, i18n.language)}</span></div>
              <time>{formatDate(item.date, i18n.language)}</time>
            </div>
          ))}</div> : <EmptyState message={t('dashboard.noUpcoming')} />}
        </section>
        <section className="section">
          <div className="section-heading"><h2>{t('dashboard.attention')}</h2><Link to="/courses">{t('common.view')}</Link></div>
          {query.data.attention.length ? <div className="compact-list">{query.data.attention.map((course) => (
            <Link className="list-row" to={'/courses/' + course.id} key={course.id}><strong>{courseName(course, i18n.language)}</strong><StatusBadge value={course.status} /></Link>
          ))}</div> : <EmptyState message={t('dashboard.noAttention')} />}
        </section>
        <section className="section">
          <div className="section-heading"><h2>{t('dashboard.backlog')}</h2><Link to="/backlog">{t('common.view')}</Link></div>
          {query.data.backlog.length ? <div className="compact-list">{query.data.backlog.map((item) => (
            <div className="list-row" key={item.id}><div><strong>{item.title}</strong><span>{courseName(item.course, i18n.language)}</span></div><span className="danger-text">{item.reasons[0]}</span></div>
          ))}</div> : <EmptyState message={t('backlog.safe')} />}
        </section>
      </div>
    </div>
  );
}

function PlanRow({ item }: { item: PlanItem }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="plan-row">
      <span className={'priority-bar ' + item.level.toLowerCase()} />
      <div className="plan-main"><strong>{item.title}</strong><span>{courseName(item.course, i18n.language)} · {item.reasons.join(' · ')}</span></div>
      <StatusBadge value={item.level} />
      {item.estimatedEffort && <small>{item.estimatedEffort} {t('common.minutes')}</small>}
    </div>
  );
}
