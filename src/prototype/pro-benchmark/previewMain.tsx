import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import ProComparisonPreview from './ProComparisonPreview';

const surfaceParam =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('surface')
    : null;
const initialSurface = surfaceParam === 'standalone' ? 'standalone' : 'profile';

createRoot(document.getElementById('pro-comparison-preview-root')!).render(
  <StrictMode>
    <ProComparisonPreview initialSurface={initialSurface} />
  </StrictMode>
);

