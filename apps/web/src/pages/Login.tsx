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
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
      await login({ identifier, password });
      const workspace = await api<{ semester: unknown | null }>('/semester-management');
      navigate(workspace.semester ? returnTo : '/onboarding', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof ApiError && requestError.status === 429
        ? t('auth.tooManyAttempts')
        : t('auth.invalidCredentials'));
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
        <p>{t('auth.description')}</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>{t('auth.username')}</span>
            <input
              name="username"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>{t('auth.password')}</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="button primary login-submit" type="submit" disabled={submitting}>
            {submitting ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>
        <p className="auth-switch"><a href="/register">{t('auth.createAccount')}</a></p>
      </section>
    </main>
  );
}
