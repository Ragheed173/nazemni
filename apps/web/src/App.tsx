import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { DailyPlanPage } from './pages/DailyPlan';
import { CoursesPage, CourseDetailsPage } from './pages/Courses';
import { EntityPage, entityConfigs } from './pages/EntityPage';
import { BacklogPage } from './pages/Backlog';
import { WeeklyReviewPage } from './pages/WeeklyReview';
import { SettingsPage } from './pages/Settings';
import { registerStudyTools } from './webmcp';

export function App() {
  useEffect(registerStudyTools, []);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
