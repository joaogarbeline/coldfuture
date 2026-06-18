import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Dashboard from '../pages/Dashboard';
import Alarmes from '../pages/Alarmes';
import Configuracao from '../pages/Configuracao';
import Relatorios from '../pages/Relatorios';
import Login from '../pages/Login';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = localStorage.getItem('coldvisio-token');
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('coldvisio-token');
  if (token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route
        path="/*"
        element={
          <MainLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/alarmes" element={<Alarmes />} />
              <Route path="/configuracao" element={<ProtectedRoute><Configuracao /></ProtectedRoute>} />
            </Routes>
          </MainLayout>
        }
      />
    </Routes>
  );
}
