import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { displayLectureTitle } from '@nazemni/shared';
import { api } from '../api';
import { courseName } from '../lib';
import type { Course } from '../types';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';

interface BacklogItem {
  id: string; kind: string; title: string; risk: number; age: number; reasons: string[]; course: Course;
}

export function BacklogPage() {
  const { t, i18n } = useTranslation();
  const query = useQuery({ queryKey: ['backlog'], queryFn: () => api<BacklogItem[]>('/backlog') });
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState retry={() => void query.refetch()} />;
  return (
    <div className="page">
      <div className="page-header"><div><h1>{t('backlog.title')}</h1><p>{t('backlog.subtitle')}</p></div></div>
      <section className="section">
        {query.data.length ? <div className="backlog-list">{query.data.map((item, index) => (
          <article className="backlog-row" key={item.kind + item.id}>
            <span className="rank">{index + 1}</span>
            <div className="backlog-main"><strong>{displayLectureTitle(item.title, t('entities.lectures.backloggedLabel'))}</strong><span>{courseName(item.course, i18n.language)}</span><ul>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
            <div className="risk-meter"><span>{t('backlog.risk')}</span><strong>{item.risk}/100</strong><meter min="0" max="100" value={item.risk} /></div>
          </article>
        ))}</div> : <EmptyState message={t('backlog.safe')} />}
      </section>
    </div>
  );
}
