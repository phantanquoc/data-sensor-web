import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Overview } from './pages/Overview';
import { FryerDetail } from './pages/FryerDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/may/:n" element={<FryerDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
