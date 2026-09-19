import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  const [form, setForm] = useState({ name: '', academicYear: `${year}/${year + 1}`, term: 'FALL', startsAt: '', endsAt: '' });
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true);
    try {
      await api('/semesters', { method: 'POST', body: JSON.stringify({ ...form, isCurrent: true }) });
      navigate('/semester?add=1', { replace: true });
    } finally { setSubmitting(false); }
  };
  return <div className="page narrow-page"><div className="page-header"><div><h1>{t('onboarding.title')}</h1><p>{t('onboarding.description')}</p></div></div><form className="section settings-form" onSubmit={submit}><label className="field"><span>{t('semester.name')}</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="field"><span>{t('semester.academicYear')}</span><input required value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} /></label><label className="field"><span>{t('semester.term')}</span><input required value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} /></label><label className="field"><span>{t('semester.startDate')}</span><input type="date" required value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label><label className="field"><span>{t('semester.endDate')}</span><input type="date" required value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label><div className="form-actions"><button className="button primary" disabled={submitting}>{t('onboarding.create')}</button><button className="button" type="button" onClick={() => navigate('/dashboard')}>{t('onboarding.skip')}</button></div></form></div>;
}
