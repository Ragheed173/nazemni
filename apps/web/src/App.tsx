import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { DailyPlanPage } from './pages/DailyPlan';
import { CoursesPage, CourseDetailsPage } from './pages/Courses';
import { EntityPage, entityConfigs } from './pages/EntityPage';
import { BacklogPage } from './pages/Backlog';
import { WeeklyReviewPage } from './pages/WeeklyReview';
import { SettingsPage } from './pages/Settings';
import { registerStudyTools } from './webmcp';
import { AuthProvider, useAuth } from './auth';
import { LoginPage } from './pages/Login';
import { SemesterManagementPage } from './pages/SemesterManagement';
import { LandingPage } from './pages/Landing';
import { RegisterPage } from './pages/Register';
import { OnboardingPage } from './pages/Onboarding';
import { ProfilePage } from './pages/Profile';
import { AdminPage } from './pages/Admin';
import { AIPage } from './pages/AI';

function RequireAuthentication({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <div className="state-box"><div className="spinner" /></div>;
  if (!session) {
    const returnTo = location.pathname + location.search;
    return <Navigate to={'/login?returnTo=' + encodeURIComponent(returnTo)} replace />;
  }
  return children;
}

function ProtectedLayout() {
  useEffect(registerStudyTools, []);
  return <Layout />;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<RequireAuthentication><ProtectedLayout /></RequireAuthentication>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="plan" element={<DailyPlanPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="courses/:id" element={<CourseDetailsPage />} />
          <Route path="lectures" element={<EntityPage config={entityConfigs.lectures!} />} />
          <Route path="tasks" element={<EntityPage config={entityConfigs.tasks!} />} />
          <Route path="assignments" element={<EntityPage config={entityConfigs.assignments!} />} />
          <Route path="projects" element={<EntityPage config={entityConfigs.projects!} />} />
          <Route path="exams" element={<EntityPage config={entityConfigs.exams!} />} />
          <Route path="grades" element={<EntityPage config={entityConfigs.grades!} />} />
          <Route path="weak-topics" element={<EntityPage config={entityConfigs['weak-topics']!} />} />
          <Route path="backlog" element={<BacklogPage />} />
          <Route path="weekly-review" element={<WeeklyReviewPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="semester" element={<SemesterManagementPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="ai" element={<AIPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
