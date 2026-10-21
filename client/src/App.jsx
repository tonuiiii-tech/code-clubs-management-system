import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, ToastProvider } from 'steamlabsui';
import { APP_THEME } from './ui/index.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { AppRoutes } from './routes/AppRoutes.jsx';

export function App() {
  return (
    <ThemeProvider theme={APP_THEME}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
