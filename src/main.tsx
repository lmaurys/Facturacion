import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthContext.tsx';
import { loadRuntimeAppConfig } from './config/appConfig.ts';
import './index.css';

const bootstrap = async () => {
  await loadRuntimeAppConfig();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>
  );
};

void bootstrap();
