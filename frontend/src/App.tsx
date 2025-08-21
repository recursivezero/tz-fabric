import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ImageDescription from './pages/ImageDescription';
import UploadPage from './pages/audiofeature';
import ContentGrid from './pages/contentGrid';
import Search from './pages/search';
import Home from './pages/Home';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/describe" element={<ImageDescription />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/view" element={<ContentGrid />} />
        <Route path='/search' element={<Search />} />
      </Routes>
    </Router>
  );
}

export default App;
