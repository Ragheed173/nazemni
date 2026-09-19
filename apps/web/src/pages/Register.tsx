import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { setLanguage } from '../i18n';

type RegistrationMode = 'OPEN' | 'INVITE_ONLY' | 'CLOSED';

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<RegistrationMode | null>(null);
  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '', confirmation: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void api<{ mode: RegistrationMode }>('/public/registration').then((data) => setMode(data.mode)).catch(() => setError(t('common.error')));
  }, [t]);
  if (session) return <Navigate to="/dashboard" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirmation) { setError(t('auth.passwordMismatch')); return; }
    setSubmitting(true); setError('');
    try {
      await api('/public/register', {
        method: 'POST',
        body: JSON.stringify({ ...form, preferredLanguage: i18n.language === 'en' ? 'en' : 'ar' }),
      });
      navigate('/login?registered=1', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof ApiError ? t('auth.registrationFailed') : t('common.error'));
    } finally { setSubmitting(false); }
  };

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="register-title">
        <div className="login-heading"><strong className="login-wordmark">{t('brand')}</strong><button className="language-button login-language" onClick={() => setLanguage(i18n.language === 'ar' ? 'en' : 'ar')}>{i18n.language === 'ar' ? 'English' : 'العربية'}</button></div>
        <h1 id="register-title">{t('auth.register')}</h1>
        {mode === 'CLOSED' ? <p className="login-error">{t('auth.registrationClosed')}</p> : (
          <form onSubmit={submit}>
            <label className="field"><span>{t('auth.email')}</span><input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label className="field"><span>{t('auth.username')}</span><input autoComplete="username" required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
            <label className="field"><span>{t('profile.displayName')}</span><input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
            {mode === 'INVITE_ONLY' && <label className="field"><span>{t('auth.inviteCode')}</span><input required value={form.inviteCode} onChange={(event) => setForm({ ...form, inviteCode: event.target.value })} /></label>}
            <label className="field"><span>{t('auth.password')}</span><input type="password" autoComplete="new-password" minLength={10} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
            <label className="field"><span>{t('auth.confirmPassword')}</span><input type="password" autoComplete="new-password" minLength={10} required value={form.confirmation} onChange={(event) => setForm({ ...form, confirmation: event.target.value })} /></label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="button primary login-submit" disabled={submitting || !mode}>{submitting ? t('common.loading') : t('auth.createAccount')}</button>
          </form>
        )}
        <p className="auth-switch"><Link to="/login">{t('auth.haveAccount')}</Link></p>
      </section>
    </main>
  );
}
