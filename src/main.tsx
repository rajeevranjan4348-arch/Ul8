import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { SettingsProvider } from './contexts/SettingsContext.tsx';
import { PremiumEffectsProvider } from './components/PremiumEffects.tsx';
import './utils/logger'; // Initialize logger

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        <PremiumEffectsProvider>
          <App />
        </PremiumEffectsProvider>
      </SettingsProvider>
    </ThemeProvider>
  </StrictMode>,
);
