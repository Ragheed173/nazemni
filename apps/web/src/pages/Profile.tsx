import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../api';
import { useAuth } from '../auth';
import { setLanguage } from '../i18n';
import { ErrorState, LoadingState } from '../components/PageState';

type Profile = { email: string; username: string | null; displayName: string; preferredLanguage: 'ar' | 'en'; role: string; createdAt: string };

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { logout, refresh } = useAuth();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/account/profile') });
  const [form, setForm] = useState<Profile | null>(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);
  const save = useMutation({ mutationFn: (value: Profile) => api('/account/profile', { method: 'PATCH', body: JSON.stringify({ displayName: value.displayName, preferredLanguage: value.preferredLanguage }) }), onSuccess: async () => { setLanguage(form!.preferredLanguage); await refresh(); await client.invalidateQueries({ queryKey: ['profile'] }); toast.success(t('common.success')); } });
  const changePassword = useMutation({ mutationFn: () => api('/account/change-password', { method: 'POST', body: JSON.stringify(passwords) }), onSuccess: () => { setPasswords({ currentPassword: '', newPassword: '', confirmation: '' }); toast.success(t('profile.passwordChanged')); } });
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !form) return <ErrorState retry={() => void query.refetch()} />;
  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate(form); };
  return <div className="page narrow-page"><div className="page-header"><div><h1>{t('profile.title')}</h1></div></div><form className="section settings-form" onSubmit={submit}><h2>{t('profile.account')}</h2><label className="field"><span>{t('auth.email')}</span><input value={form.email} disabled /></label><label className="field"><span>{t('auth.username')}</span><input value={form.username ?? ''} disabled /></label><label className="field"><span>{t('profile.displayName')}</span><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label><label className="field"><span>{t('common.language')}</span><select value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value as 'ar' | 'en' })}><option value="ar">العربية</option><option value="en">English</option></select></label><p>{t('profile.createdAt')}: <span dir="auto">{new Date(form.createdAt).toLocaleDateString(i18n.resolvedLanguage === 'ar' ? 'ar-PS' : 'en-GB')}</span></p><div className="form-actions"><button className="button primary" disabled={save.isPending}>{t('common.save')}</button></div></form><form className="section settings-form" onSubmit={(event) => { event.preventDefault(); changePassword.mutate(); }}><h2>{t('profile.changePassword')}</h2><label className="field"><span>{t('profile.currentPassword')}</span><input type="password" autoComplete="current-password" required value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} /></label><label className="field"><span>{t('profile.newPassword')}</span><input type="password" minLength={10} autoComplete="new-password" required value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} /></label><label className="field"><span>{t('auth.confirmPassword')}</span><input type="password" minLength={10} autoComplete="new-password" required value={passwords.confirmation} onChange={(e) => setPasswords({ ...passwords, confirmation: e.target.value })} /></label><div className="form-actions"><button className="button primary" disabled={changePassword.isPending}>{t('profile.changePassword')}</button><button type="button" className="button" onClick={() => void api('/account/logout-all', { method: 'POST' }).finally(() => logout())}>{t('profile.logoutAll')}</button></div></form></div>;
}
