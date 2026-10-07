import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Exams from './pages/Exams';
import ExamBuilder from './pages/ExamBuilder';
import ExamRoom from './pages/ExamRoom';
import ExamResult from './pages/ExamResult';
import QuestionBank from './pages/QuestionBank';
import Classes from './pages/Classes';
import ClassDetail from './pages/ClassDetail';
import Reports from './pages/Reports';
import ImportPage from './pages/ImportPage';
import Settings from './pages/Settings';
import Grading from './pages/Grading';
import Proctor from './pages/Proctor';
import AIStudio from './pages/AIStudio';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="exams" element={<Exams />} />
        <Route path="exams/new" element={<ExamBuilder />} />
        <Route path="exams/:id/edit" element={<ExamBuilder />} />
        <Route path="exam/:id" element={<ExamRoom />} />
        <Route path="exam/:id/result" element={<ExamResult />} />
        <Route path="questions" element={<QuestionBank />} />
        <Route path="classes" element={<Classes />} />
        <Route path="classes/:id" element={<ClassDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="grading" element={<Grading />} />
        <Route path="proctor" element={<Proctor />} />
        <Route path="ai-studio" element={<AIStudio />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}