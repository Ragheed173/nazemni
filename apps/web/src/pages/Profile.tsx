import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { api } from '../api';
import { useAuth } from '../auth';
import { setLanguage } from '../i18n';
import { ErrorState, LoadingState } from '../components/PageState';

type Profile = {
  email: string;
  username: string | null;
  displayName: string;
  preferredLanguage: 'ar' | 'en';
  role: 'USER' | 'ADMIN';
  createdAt: string;
};

type TwoFactorSetup = { totpURI: string; backupCodes: string[]; qrCode: string };

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { logout, refresh, session, enableTwoFactor, verifyTwoFactor, disableTwoFactor } = useAuth();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/account/profile') });
  const [form, setForm] = useState<Profile | null>(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);

  const save = useMutation({
    mutationFn: (value: Profile) => api('/account/profile', { method: 'PATCH', body: JSON.stringify({ displayName: value.displayName, preferredLanguage: value.preferredLanguage }) }),
    onSuccess: async () => {
      setLanguage(form!.preferredLanguage);
      await refresh();
      await client.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('common.success'));
    },
  });
  const changePassword = useMutation({
    mutationFn: () => api('/account/change-password', { method: 'POST', body: JSON.stringify(passwords) }),
    onSuccess: () => {
      setPasswords({ currentPassword: '', newPassword: '', confirmation: '' });
      toast.success(t('profile.passwordChanged'));
    },
  });
  const startTwoFactor = useMutation({
    mutationFn: async () => {
      const result = await enableTwoFactor(twoFactorPassword);
      const qrCode = await QRCode.toDataURL(result.totpURI, { width: 220, margin: 1 });
      return { ...result, qrCode };
    },
    onSuccess: (result) => {
      setSetup(result);
      setTwoFactorPassword('');
      toast.success(t('profile.twoFactorScanReady'));
    },
    onError: () => toast.error(t('profile.twoFactorError')),
  });
  const confirmTwoFactor = useMutation({
    mutationFn: () => verifyTwoFactor(twoFactorCode),
    onSuccess: async () => {
      setTwoFactorCode('');
      await refresh();
      toast.success(t('profile.twoFactorEnabled'));
    },
    onError: () => toast.error(t('auth.invalidTwoFactorCode')),
  });
  const turnOffTwoFactor = useMutation({
    mutationFn: () => disableTwoFactor(twoFactorPassword),
    onSuccess: () => {
      setTwoFactorPassword('');
      setSetup(null);
      toast.success(t('profile.twoFactorDisabled'));
    },
    onError: () => toast.error(t('profile.twoFactorError')),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !form) return <ErrorState retry={() => void query.refetch()} />;
  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate(form); };
  const twoFactorEnabled = session?.user.twoFactorEnabled === true;

  return <div className="page narrow-page">
    <div className="page-header"><div><h1>{t('profile.title')}</h1></div></div>
    {form.role === 'ADMIN' && !twoFactorEnabled && <div className="section security-notice" role="alert">
      <strong>{t('profile.twoFactorRequired')}</strong>
      <p>{t('profile.twoFactorRequiredDescription')}</p>
    </div>}
    <form className="section settings-form" onSubmit={submit}>
      <h2>{t('profile.account')}</h2>
      <label className="field"><span>{t('auth.email')}</span><input value={form.email} disabled /></label>
      <label className="field"><span>{t('auth.username')}</span><input value={form.username ?? ''} disabled /></label>
      <label className="field"><span>{t('profile.displayName')}</span><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
      <label className="field"><span>{t('common.language')}</span><select value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value as 'ar' | 'en' })}><option value="ar">العربية</option><option value="en">English</option></select></label>
      <p>{t('profile.createdAt')}: <span dir="auto">{new Date(form.createdAt).toLocaleDateString(i18n.resolvedLanguage === 'ar' ? 'ar-PS' : 'en-GB')}</span></p>
      <div className="form-actions"><button className="button primary" disabled={save.isPending}>{t('common.save')}</button></div>
    </form>
    <section className="section settings-form" aria-labelledby="two-factor-title">
      <h2 id="two-factor-title">{t('profile.twoFactor')}</h2>
      <p>{twoFactorEnabled ? t('profile.twoFactorActive') : t('profile.twoFactorDescription')}</p>
      {!twoFactorEnabled && !setup && <form onSubmit={(event) => { event.preventDefault(); startTwoFactor.mutate(); }}>
        <label className="field"><span>{t('profile.currentPassword')}</span><input type="password" autoComplete="current-password" required value={twoFactorPassword} onChange={(event) => setTwoFactorPassword(event.target.value)} /></label>
        <div className="form-actions"><button className="button primary" disabled={startTwoFactor.isPending}>{t('profile.enableTwoFactor')}</button></div>
      </form>}
      {!twoFactorEnabled && setup && <div className="two-factor-setup">
        <p>{t('profile.scanAuthenticator')}</p>
        <img className="two-factor-qr" src={setup.qrCode} alt={t('profile.authenticatorQr')} />
        <details><summary>{t('profile.manualSetup')}</summary><code dir="ltr" className="totp-uri">{setup.totpURI}</code></details>
        <form onSubmit={(event) => { event.preventDefault(); confirmTwoFactor.mutate(); }}>
          <label className="field"><span>{t('auth.twoFactorCode')}</span><input inputMode="numeric" autoComplete="one-time-code" required value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} /></label>
          <div className="form-actions"><button className="button primary" disabled={confirmTwoFactor.isPending}>{t('auth.verify')}</button></div>
        </form>
        <div className="backup-codes" role="status">
          <strong>{t('profile.backupCodes')}</strong>
          <p>{t('profile.backupCodesWarning')}</p>
          <ul dir="ltr">{setup.backupCodes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
        </div>
      </div>}
      {twoFactorEnabled && form.role !== 'ADMIN' && <form onSubmit={(event) => { event.preventDefault(); turnOffTwoFactor.mutate(); }}>
        <label className="field"><span>{t('profile.currentPassword')}</span><input type="password" autoComplete="current-password" required value={twoFactorPassword} onChange={(event) => setTwoFactorPassword(event.target.value)} /></label>
        <div className="form-actions"><button className="button" disabled={turnOffTwoFactor.isPending}>{t('profile.disableTwoFactor')}</button></div>
      </form>}
    </section>
    <form className="section settings-form" onSubmit={(event) => { event.preventDefault(); changePassword.mutate(); }}>
      <h2>{t('profile.changePassword')}</h2>
      <label className="field"><span>{t('profile.currentPassword')}</span><input type="password" autoComplete="current-password" required value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} /></label>
      <label className="field"><span>{t('profile.newPassword')}</span><input type="password" minLength={10} autoComplete="new-password" required value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} /></label>
      <label className="field"><span>{t('auth.confirmPassword')}</span><input type="password" minLength={10} autoComplete="new-password" required value={passwords.confirmation} onChange={(e) => setPasswords({ ...passwords, confirmation: e.target.value })} /></label>
      <div className="form-actions"><button className="button primary" disabled={changePassword.isPending}>{t('profile.changePassword')}</button><button type="button" className="button" onClick={() => void api('/account/logout-all', { method: 'POST' }).finally(() => logout())}>{t('profile.logoutAll')}</button></div>
    </form>
  </div>;
}
