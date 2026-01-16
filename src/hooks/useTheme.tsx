import { useEffect, useState } from 'react';
import { nativeStorage, STORAGE_KEYS } from '@/utils/nativeStorage';

type Theme = 'light' | 'dark' | 'system';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('system');

  // Load theme from native storage
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await nativeStorage.getItem(STORAGE_KEYS.THEME) as Theme;
      if (savedTheme) {
        setTheme(savedTheme);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (theme: Theme) => {
      root.classList.remove('light', 'dark');
      
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    };

    applyTheme(theme);
    
    // Save theme to native storage
    nativeStorage.setItem(STORAGE_KEYS.THEME, theme);

    // Listen for system theme changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme(theme);
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return { theme, setTheme };
};