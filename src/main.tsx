import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { useAuthStore } from './store/authStore.ts';

import ErrorBoundary from './components/ErrorBoundary.tsx'

// Initialize theme from localStorage on app load
const initialTheme = localStorage.getItem('theme');
if (initialTheme === 'dark' || !initialTheme) {
  useAuthStore.getState().setDarkMode(true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
