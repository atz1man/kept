import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { Rights } from './Rights';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Rights />
  </StrictMode>,
);
