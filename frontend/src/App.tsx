import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './hooks/useAuth';
import { LanguageProvider } from './i18n';

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;