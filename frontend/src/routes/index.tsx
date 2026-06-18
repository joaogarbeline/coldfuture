import { Routes, Route } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import Historico from '../pages/Historico';
import Alarmes from '../pages/Alarmes';
import Configuracao from '../pages/Configuracao';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/historico" element={<Historico />} />
      <Route path="/alarmes" element={<Alarmes />} />
      <Route path="/configuracao" element={<Configuracao />} />
    </Routes>
  );
}
