import React from 'react';
import { Sun, Moon, Sword } from 'lucide-react';

interface NavbarProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export function Navbar({ darkMode, toggleDarkMode }: NavbarProps) {
  return (
    <nav className="w-full px-6 py-4 flex items-center justify-between border-b dark:border-gray-700">
      <div className="flex items-center space-x-2">
        <Sword className="w-8 h-8 text-purple-600" />
        <span className="text-xl font-bold dark:text-white">NinjaTool.ai</span>
      </div>
      <button
        onClick={toggleDarkMode}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {darkMode ? (
          <Sun className="w-5 h-5 text-yellow-500" />
        ) : (
          <Moon className="w-5 h-5 text-gray-600" />
        )}
      </button>
    </nav>
  );
}