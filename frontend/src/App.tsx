import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import UploadPage from './pages/audiofeature';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<UploadPage />} />
      </Routes>
    </Router>
  );
}

export default App;
