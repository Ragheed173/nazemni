import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import { ErrorState, LoadingState } from '../components/PageState';

type Source = { url: string; title: string; excerpt: string | null; sourceType: string; isOfficial: boolean; retrievedAt: string };
type Entry = {
  id: string; university: string; program: string; courseCode: string; courseName: string; credits: number | null;
  description: string | null; prerequisites: string[]; topics: string[]; assessmentInfo: string[];
  officialUrl: string | null; status: 'VERIFIED' | 'PARTIAL' | 'NOT_VERIFIED'; confidence: number;
  lastVerifiedAt: string | null; sources: Source[];
};
type LookupResult =
  | { outcome: 'FOUND'; cached: boolean; entry: Entry }
  | { outcome: 'AMBIGUOUS'; cached: false; alternatives: Array<{ courseCode: string; courseName: string }> }
  | { outcome: 'NOT_VERIFIED'; cached: false; alternatives: Array<{ courseCode: string; courseName: string }> };

export function CourseIntelligencePage() {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({ university: '', program: '', query: '' });
  const [result, setResult] = useState<LookupResult>();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const status = useQuery({ queryKey: ['course-intelligence-status'], queryFn: () => api<{ enabled: boolean }>('/course-intelligence/status'), retry: false });
  const lookup = useMutation({
    mutationFn: (input: typeof form) => api<LookupResult>('/course-intelligence/lookup', { method: 'POST', body: JSON.stringify(input) }),
    onMutate: () => { setResult(undefined); setAnswer(''); },
    onSuccess: (data) => { setResult(data); setAnswer(''); },
  });
  const refresh = useMutation({
    mutationFn: (id: string) => api<LookupResult>(`/course-intelligence/entries/${id}/refresh`, { method: 'POST', body: '{}' }),
    onSuccess: (data) => { setResult(data); setAnswer(''); },
  });
  const ask = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => api<{ answer: string }>(`/course-intelligence/entries/${id}/questions`, { method: 'POST', body: JSON.stringify({ question: value }) }),
    onSuccess: (data) => { setAnswer(data.answer); setQuestion(''); },
  });

  if (status.isLoading) return <LoadingState />;
  if (status.isError) return <ErrorState retry={() => void status.refetch()} />;
  if (!status.data?.enabled) return <Navigate to="/dashboard" replace />;

  const entry = result?.outcome === 'FOUND' ? result.entry : undefined;
  const isCached = result?.outcome === 'FOUND' && result.cached;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (lookup.isPending) return;
    setResult(undefined);
    setAnswer('');
    lookup.mutate(form);
  };
  return <div className="page course-intelligence-page">
    <div className="page-header"><div><h1>{t('courseIntelligence.title')}</h1><p>{t('courseIntelligence.subtitle')}</p></div></div>
    <form className="section course-lookup-form" onSubmit={submit}>
      <label className="field"><span>{t('courseIntelligence.university')}</span><input required maxLength={200} value={form.university} onChange={(event) => setForm({ ...form, university: event.target.value })} /></label>
      <label className="field"><span>{t('courseIntelligence.program')}</span><input required maxLength={200} value={form.program} onChange={(event) => setForm({ ...form, program: event.target.value })} /></label>
      <label className="field"><span>{t('courseIntelligence.courseQuery')}</span><input required maxLength={200} value={form.query} onChange={(event) => setForm({ ...form, query: event.target.value })} /></label>
      <div className="course-lookup-action"><button className="button primary" disabled={lookup.isPending}>{lookup.isPending ? t('courseIntelligence.searching') : t('courseIntelligence.search')}</button></div>
    </form>
    {(lookup.isError || refresh.isError) && <p className="form-error">{t('courseIntelligence.error')}</p>}
    {result?.outcome === 'NOT_VERIFIED' && <div className="section empty-state"><strong>{t('courseIntelligence.notVerified')}</strong><span>{t('courseIntelligence.notVerifiedHint')}</span></div>}
    {result?.outcome === 'AMBIGUOUS' && <section className="section"><div className="section-heading"><h2>{t('courseIntelligence.ambiguous')}</h2></div><ul className="fact-list">{result.alternatives.map((item) => <li key={`${item.courseCode}-${item.courseName}`}><strong dir="ltr">{item.courseCode}</strong> — {item.courseName}</li>)}</ul></section>}
    {entry && <>
      <section className="section catalog-result">
        <div className="catalog-result-heading"><div><span className="course-code">{entry.courseCode}</span><h2>{entry.courseName}</h2><p>{entry.university} · {entry.program}</p></div><span className={`badge ${entry.status === 'VERIFIED' ? 'success' : entry.status === 'PARTIAL' ? 'warning' : 'neutral'}`}>{t(`courseIntelligence.status.${entry.status}`)}</span></div>
        <div className="catalog-meta"><span>{t('courseIntelligence.lastChecked')}: {entry.lastVerifiedAt ? new Intl.DateTimeFormat(i18n.language).format(new Date(entry.lastVerifiedAt)) : '—'}</span><span>{isCached ? t('courseIntelligence.cached') : t('courseIntelligence.fresh')}</span><button className="text-button" type="button" disabled={refresh.isPending} onClick={() => refresh.mutate(entry.id)}>{t('courseIntelligence.refresh')}</button></div>
        <Fact title={t('courseIntelligence.credits')} values={entry.credits == null ? [] : [String(entry.credits)]} empty={t('courseIntelligence.missing')} />
        <Fact title={t('courseIntelligence.description')} values={entry.description ? [entry.description] : []} empty={t('courseIntelligence.missing')} />
        <Fact title={t('courseIntelligence.prerequisites')} values={entry.prerequisites} empty={t('courseIntelligence.missing')} />
        <Fact title={t('courseIntelligence.topics')} values={entry.topics} empty={t('courseIntelligence.missing')} />
        <Fact title={t('courseIntelligence.assessment')} values={entry.assessmentInfo} empty={t('courseIntelligence.missing')} />
      </section>
      <section className="section"><div className="section-heading"><h2>{t('courseIntelligence.sources')}</h2></div><div className="source-list">{entry.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><strong>{source.title}</strong><span>{source.isOfficial ? t('courseIntelligence.official') : t('courseIntelligence.secondary')}</span><small>{source.url}</small></a>)}</div></section>
      <section className="section"><div className="section-heading"><h2>{t('courseIntelligence.askTitle')}</h2></div><p className="muted">{t('courseIntelligence.askHint')}</p><form className="catalog-question" onSubmit={(event) => { event.preventDefault(); if (question.trim()) ask.mutate({ id: entry.id, value: question.trim() }); }}><input maxLength={300} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t('courseIntelligence.askPlaceholder')} /><button className="button secondary" disabled={ask.isPending || !question.trim()}>{t('courseIntelligence.ask')}</button></form>{ask.isError && <p className="form-error">{t('courseIntelligence.scopeError')}</p>}{answer && <p className="catalog-answer">{answer}</p>}</section>
    </>}
  </div>;
}

function Fact({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return <div className="catalog-fact"><h3>{title}</h3>{values.length ? <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p className="muted">{empty}</p>}</div>;
}
