import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { setLanguage } from '../i18n';

function safeReturnTo(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login')
    ? value
    : '/dashboard';
}

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { session, login, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  useEffect(() => {
    if (session) navigate(returnTo, { replace: true });
  }, [navigate, returnTo, session]);

  if (session) return <Navigate to={returnTo} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (requiresTwoFactor) {
        await verifyTwoFactor(twoFactorCode, useBackupCode);
      } else {
        const result = await login({ identifier, password });
        if (result.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          setPassword('');
          return;
        }
      }
      const workspace = await api<{ semester: unknown | null }>('/semester-management');
      navigate(workspace.semester ? returnTo : '/onboarding', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof ApiError && requestError.status === 429
        ? t('auth.tooManyAttempts')
        : requiresTwoFactor ? t('auth.invalidTwoFactorCode') : t('auth.invalidCredentials'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-heading">
          <strong className="login-wordmark">{t('brand')}</strong>
          <button
            className="language-button login-language"
            type="button"
            onClick={() => setLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
          >
            {i18n.language === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
        <h1 id="login-title">{t('auth.login')}</h1>
        <p>{requiresTwoFactor ? t('auth.twoFactorDescription') : t('auth.description')}</p>
        <form onSubmit={submit}>
          {!requiresTwoFactor && <label className="field">
            <span>{t('auth.username')}</span>
            <input
              name="username"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
              autoFocus
            />
          </label>}
          {!requiresTwoFactor && <label className="field">
            <span>{t('auth.password')}</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>}
          {requiresTwoFactor && <label className="field">
            <span>{useBackupCode ? t('auth.backupCode') : t('auth.twoFactorCode')}</span>
            <input
              name="two-factor-code"
              inputMode={useBackupCode ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              value={twoFactorCode}
              onChange={(event) => setTwoFactorCode(event.target.value)}
              required
              autoFocus
            />
          </label>}
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="button primary login-submit" type="submit" disabled={submitting}>
            {submitting ? t('auth.signingIn') : requiresTwoFactor ? t('auth.verify') : t('auth.signIn')}
          </button>
          {requiresTwoFactor && <button className="text-button" type="button" onClick={() => { setUseBackupCode(!useBackupCode); setTwoFactorCode(''); }}>
            {useBackupCode ? t('auth.useAuthenticatorCode') : t('auth.useBackupCode')}
          </button>}
        </form>
        {!requiresTwoFactor && <p className="auth-switch"><a href="/register">{t('auth.createAccount')}</a></p>}
      </section>
    </main>
  );
}
