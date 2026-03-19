import { createRoot } from 'react-dom/client';
import { SonioxProvider } from '@soniox/react';
import App from './App';
import './index.css';

const sonioxApiKey = (import.meta.env.VITE_SONIOX_API_KEY ?? '').trim();

createRoot(document.getElementById('root')!).render(
  <SonioxProvider apiKey={sonioxApiKey}>
    <App />
  </SonioxProvider>,
);
