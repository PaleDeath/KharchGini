"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark'; // The actual theme being used (resolves 'system')
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('system');
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Function to get system preference
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // Function to apply theme to document
  const applyTheme = (themeToApply: 'light' | 'dark') => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(themeToApply);
      setActualTheme(themeToApply);
    }
  };

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('theme') as Theme;
      if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
        setTheme(storedTheme);
      } else {
        // Set default based on system preference
        const systemTheme = getSystemTheme();
        setActualTheme(systemTheme);
        applyTheme(systemTheme);
      }
    }
  }, []);

  // Apply theme whenever theme changes (only after mount to prevent hydration issues)
  useEffect(() => {
    if (!mounted) return;
    
    let themeToApply: 'light' | 'dark';
    
    if (theme === 'system') {
      themeToApply = getSystemTheme();
    } else {
      themeToApply = theme;
    }
    
    applyTheme(themeToApply);
  }, [theme, mounted]);

  // Listen for system theme changes when using 'system'
  useEffect(() => {
    if (!mounted || theme !== 'system') return;
    
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        applyTheme(getSystemTheme());
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, mounted]);

  // Update theme and persist to localStorage
  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
  };

  // Prevent rendering until mounted to avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: updateTheme, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 