import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './typo/polices';
import './styles.css';
import { installerNoirParler } from './typo/noirParler';

installerNoirParler();

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
