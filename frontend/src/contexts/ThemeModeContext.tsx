import { createContext, useContext } from 'react';

interface ThemeModeContextValue {
  dark: boolean;
  toggle: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  dark: false,
  toggle: () => {},
});

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
