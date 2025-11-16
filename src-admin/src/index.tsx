import React from 'react';
import { createRoot } from 'react-dom/client';

// Wichtig: Imports von adapter-react-v5 (der Pfad wird durch tsconfig.json aufgelöst)
import { Utils, Theme } from '@iobroker/adapter-react-v5';
import App from './app';

function build() {
    const container = document.getElementById('root');
    if (!container) return;
    const root = createRoot(container);

    // Wir verwenden die Standard-Theme-Erstellung von adapter-react-v5
    root.render(
        <App />
    );
}

build();