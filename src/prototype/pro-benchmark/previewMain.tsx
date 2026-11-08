import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import ProComparisonPreview from './ProComparisonPreview';

createRoot(document.getElementById('pro-comparison-preview-root')!).render(
  <StrictMode>
    <ProComparisonPreview />
  </StrictMode>
);
