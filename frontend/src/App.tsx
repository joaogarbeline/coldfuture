import { useState, useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeModeContext } from './contexts/ThemeModeContext';
import AppRoutes from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1565c0' },
    secondary: { main: '#00838f' },
    background: { default: '#f5f5f5' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#42a5f5' },
    secondary: { main: '#26c6da' },
    background: { default: '#0d1b2a', paper: '#1b2838' },
    text: { primary: '#e0e0e0', secondary: '#b0bec5' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
  },
});

export default function App() {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('coldvisio-theme') === 'dark';
  });

  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem('coldvisio-theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const themeModeValue = useMemo(() => ({ dark, toggle }), [dark]);

  const theme = useMemo(() => (dark ? darkTheme : lightTheme), [dark]);

  return (
    <ThemeModeContext.Provider value={themeModeValue}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ThemeModeContext.Provider>
  );
}
