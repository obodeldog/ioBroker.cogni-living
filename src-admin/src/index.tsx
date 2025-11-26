import React from 'react';
import { createRoot } from 'react-dom/client';
import { Utils } from '@iobroker/adapter-react-v5';
import App from './app';

const adapterName = 'cogni-living';

function build() {
    const container = document.getElementById('root');
    if (!container) return;
    const root = createRoot(container);

    // Wir übergeben den adapterName explizit, damit I18n den Scope kennt
    root.render(<App adapterName={adapterName} />);
}

build();