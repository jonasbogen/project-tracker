import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import Bifrost from '@intility/bifrost-react/Bifrost';
import '@intility/bifrost-css/dist/bifrost.css';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <React.StrictMode>
    <Bifrost>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Bifrost>
  </React.StrictMode>,
);
