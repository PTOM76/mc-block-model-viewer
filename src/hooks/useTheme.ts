import { useEffect } from 'react';

export const useTheme = (themeMode: 'system' | 'dark' | 'light', setThemeMode: (mode: any)=>void) => {
  useEffect(() => {
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = themeMode === 'dark' || (themeMode === 'system' && darkQuery.matches);
    
    const applyTheme = () => {
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    };
    applyTheme();

    const handleChange = (e: MediaQueryListEvent) => applyTheme();
    darkQuery.addEventListener('change', handleChange);

    const handleSetTheme = (_e: any, mode: string) => setThemeMode(mode as any);
    window.ipcRenderer?.on('set-theme', handleSetTheme);

    return () => {
      darkQuery.removeEventListener('change', handleChange);
    };

  }, [themeMode]);
};
