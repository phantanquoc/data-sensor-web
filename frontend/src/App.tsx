import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Overview } from './pages/Overview';
import { FryerDetail } from './pages/FryerDetail';
import { Login } from './pages/Login';
import { ScrollToTop } from './components/ScrollToTop';
import { getMe } from './api';

function App() {
  const baseUrl = import.meta.env.BASE_URL;
  const basename = baseUrl === '/' ? undefined : baseUrl.replace(/\/$/, '');

  // null = đang kiểm tra phiên; true/false = kết quả.
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getMe()
      .then((r) => setAuthed(r.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    // Chờ xác định phiên — tránh nháy trang login rồi mới vào dashboard.
    return <div className="grid min-h-screen place-items-center bg-surface text-text-muted">Đang tải…</div>;
  }

  return (
    <BrowserRouter basename={basename}>
      <ScrollToTop />
      {authed ? (
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={<Overview />} />
          <Route path="/may/:n" element={<FryerDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/login" element={<Login onSuccess={() => setAuthed(true)} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;
