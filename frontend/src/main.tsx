import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element "#root" not found in index.html');
}

const isFigmaPreview = window.location.pathname.startsWith('/figma-preview');

async function renderApp() {
  if (isFigmaPreview) {
    const { default: FigmaPreviewPage } = await import('./figma-preview/FigmaPreviewPage');
    createRoot(rootElement!).render(
      <StrictMode>
        <FigmaPreviewPage />
      </StrictMode>,
    );
    return;
  }

  await import('./styles/design-system.css');
  const { default: App } = await import('./App');
  createRoot(rootElement!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void renderApp();
