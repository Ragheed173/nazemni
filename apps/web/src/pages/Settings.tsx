import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../api';
import { setLanguage } from '../i18n';
import { ErrorState, LoadingState } from '../components/PageState';

interface Settings {
  language: 'ar' | 'en';
  weeklyReviewDay: number;
  defaultTarget: string;
  retakeBonus: number;
  firstReviewHours: number;
  focusModeManual: boolean | null;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings') });
  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);
  const mutation = useMutation({
    mutationFn: (data: Settings) => api('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { toast.success(t('common.success')); void client.invalidateQueries({ queryKey: ['settings'] }); },
  });
  if (query.isLoading || !form) return <LoadingState />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;
  const submit = (event: FormEvent) => { event.preventDefault(); setLanguage(form.language); mutation.mutate(form); };
  return (
    <div className="page narrow-page">
      <div className="page-header"><div><h1>{t('settings.title')}</h1><p>{t('settings.description')}</p></div></div>
      <form className="section settings-form" onSubmit={submit}>
        <h2>{t('settings.planning')}</h2>
        <label className="field"><span>{t('common.language')}</span><select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as 'ar' | 'en' })}><option value="ar">العربية</option><option value="en">English</option></select></label>
        <label className="field"><span>{t('settings.weeklyDay')}</span><select value={form.weeklyReviewDay} onChange={(e) => setForm({ ...form, weeklyReviewDay: Number(e.target.value) })}><option value="6">{t('settings.saturday')}</option></select></label>
        <label className="field"><span>{t('settings.target')}</span><select value={form.defaultTarget} onChange={(e) => setForm({ ...form, defaultTarget: e.target.value })}><option>B</option><option>B+</option><option>A-</option><option>A</option></select></label>
        <label className="field"><span>{t('settings.retakeBonus')}</span><input type="number" min="0" max="30" value={form.retakeBonus} onChange={(e) => setForm({ ...form, retakeBonus: Number(e.target.value) })} /></label>
        <label className="field"><span>{t('settings.firstReview')}</span><input type="number" min="6" max="168" value={form.firstReviewHours} onChange={(e) => setForm({ ...form, firstReviewHours: Number(e.target.value) })} /></label>
        <label className="field"><span>{t('settings.focusManual')}</span><select value={form.focusModeManual == null ? 'auto' : String(form.focusModeManual)} onChange={(e) => setForm({ ...form, focusModeManual: e.target.value === 'auto' ? null : e.target.value === 'true' })}><option value="auto">{t('settings.auto')}</option><option value="true">{t('settings.enabled')}</option><option value="false">{t('settings.disabled')}</option></select></label>
        <div className="form-actions"><button className="button primary" disabled={mutation.isPending}>{t('common.save')}</button></div>
      </form>
    </div>
  );
}
