import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { PaperPage } from './pages/PaperPage';
import { ChapterPage } from './pages/ChapterPage';
import { SimulationPage } from './pages/SimulationPage';
import { NotFound } from './pages/NotFound';
import { useApp } from './state/store';

export default function App() {
  const theme = useApp((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="physics/:paper" element={<PaperPage />} />
        <Route path="physics/:paper/chapter/:chapter" element={<ChapterPage />} />
        <Route path="physics/:paper/chapter/:chapter/:simId" element={<SimulationPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
