import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';

hydrateRoot(
  document.getElementById('root') as HTMLElement,
  <StrictMode>
    <StartClient />
  </StrictMode>
);
