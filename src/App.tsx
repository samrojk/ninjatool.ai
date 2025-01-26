import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ImageEditor } from './components/ImageEditor';

function App() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      <Navbar darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} />
      <main className="flex-1">
        <ImageEditor />
      </main>
    </div>
  );
}

export default App;