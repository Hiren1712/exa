import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './hooks/useAuth';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;