import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AdminProvider } from './lib/admin-store.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminProvider>
      <div className="admin-shell min-h-screen text-slate-900">
        <App />
      </div>
    </AdminProvider>
  </StrictMode>,
);
