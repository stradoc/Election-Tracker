/**
 * main.tsx: web app entry point. Loads fonts and global styles, sets up data caching and
 * routing, and mounts the app.
 *
 * Routes:
 *   /                          → the newest registered election
 *   /:year/:office[/:state]    ElectionPage (state = lower-case postal code)
 */

import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/sora/400.css';
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
import './styles/tokens.css';
import './styles/base.css';
import './map/bins.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ELECTIONS } from '@tippingpoint/shared';
import { ElectionPage, viewPath } from './pages/ElectionPage.tsx';

const queryClient = new QueryClient();
const newest = ELECTIONS[0];
const home = newest === undefined ? '/' : viewPath(newest.year, newest.office);

const root = document.getElementById('root');
if (root === null) throw new Error('index.html is missing <div id="root">');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route path="/:year/:office/:state?" element={<ElectionPage />} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
