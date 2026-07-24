import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Overview } from './pages/Overview';
import { FryerDetail } from './pages/FryerDetail';
import { ScrollToTop } from './components/ScrollToTop';

function App() {
  const baseUrl = import.meta.env.BASE_URL;
  const basename = baseUrl === '/' ? undefined : baseUrl.replace(/\/$/, '');

  return (
    <BrowserRouter basename={basename}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/may/:n" element={<FryerDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
