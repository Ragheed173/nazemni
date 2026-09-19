import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth';
import { setLanguage } from '../i18n';

export function LandingPage() {
  const { session, isLoading } = useAuth();
  const { t, i18n } = useTranslation();
  if (isLoading) return <div className="state-box"><div className="spinner" /></div>;
  if (session) return <Navigate to="/dashboard" replace />;
  return (
    <main className="login-shell public-shell">
      <section className="login-card landing-card">
        <div className="login-heading">
          <strong className="login-wordmark">{t('brand')}</strong>
          <button className="language-button login-language" onClick={() => setLanguage(i18n.language === 'ar' ? 'en' : 'ar')}>
            {i18n.language === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
        <h1>{t('landing.title')}</h1>
        <p>{t('landing.description')}</p>
        <div className="form-actions landing-actions">
          <Link className="button primary" to="/login">{t('auth.login')}</Link>
          <Link className="button" to="/register">{t('auth.register')}</Link>
        </div>
      </section>
    </main>
  );
}
