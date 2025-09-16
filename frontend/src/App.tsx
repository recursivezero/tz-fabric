import './App.css';
import { Routing } from './Routing';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';



const App = () => {

  const location = useLocation();

  useEffect(() => {
    const body = document.body;

    if (location.pathname === "/chat") {
      body.classList.remove("app-background");
    } else {
      body.classList.add("app-background");
    }
  }, [location]);
  return (
    <div className="container">
      <header className="header">
        <div className="logo-title">
          <h1>Fabric Finder</h1>
        </div>
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/describe">Describe</a></li>
            <li><a href="/upload">Upload</a></li>
            <li><a href="/view">List</a></li>
            <li><a href="/search">Search</a></li>
            <li><a href="/chat">Chat</a></li>
          </ul>
        </nav>
      </header>
      <main>
        <Routing />
      </main>
    </div>
  );
}

export default App;
