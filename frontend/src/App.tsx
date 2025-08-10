import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import UploadPage from './pages/audiofeature';
import ContentGrid from './pages/contentGrid';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/view" element={<ContentGrid />} />
      </Routes>
    </Router>
  );
}

export default App;
