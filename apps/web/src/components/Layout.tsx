import { useState } from 'react';
import { Menu, Plus, X } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';

const nav = [
  ['dashboard', '/'], ['dailyPlan', '/plan'], ['courses', '/courses'], ['tasks', '/tasks'],
  ['backlog', '/backlog'], ['weeklyReview', '/weekly-review'],
  ['lectures', '/lectures'], ['assignments', '/assignments'], ['projects', '/projects'],
  ['exams', '/exams'], ['grades', '/grades'], ['weakTopics', '/weak-topics'],
] as const;

export function Layout() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="app-shell">
      <header className="mobile-header">
        <button className="icon-button" onClick={() => setOpen(true)} aria-label={t('common.view')}><Menu /></button>
        <strong>{t('brand')}</strong>
        <NavLink className="icon-button" to="/tasks?add=1" aria-label={t('common.add')}><Plus /></NavLink>
      </header>
      {open && <button className="sidebar-scrim" aria-label={t('common.close')} onClick={close} />}
      <aside className={'sidebar ' + (open ? 'open' : '')}>
        <div className="brand-row">
          <NavLink className="wordmark" to="/" onClick={close}>{t('brand')}</NavLink>
          <button className="icon-button sidebar-close" onClick={close} aria-label={t('common.close')}><X /></button>
        </div>
        <nav aria-label={t('brand')}>
          <div className="nav-primary">
            {nav.slice(0, 6).map(([key, to]) => <NavLink key={key} to={to} onClick={close}>{t('nav.' + key)}</NavLink>)}
          </div>
          <div className="nav-section">
            {nav.slice(6).map(([key, to]) => <NavLink key={key} to={to} onClick={close}>{t('nav.' + key)}</NavLink>)}
          </div>
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/settings" onClick={close}>{t('nav.settings')}</NavLink>
          <button className="language-button" onClick={() => setLanguage(i18n.language === 'ar' ? 'en' : 'ar')}>
            {i18n.language === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
      </aside>
      <main className="main-content"><Outlet /></main>
    </div>
  );
}
