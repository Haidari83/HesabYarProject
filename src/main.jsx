
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BusinessDataProvider } from "./context/BusinessDataProvider";

import App from './App';

// فایل‌های پایه طراحی
import './styles/fonts.css';
import './styles/variables.css';
import './styles/global.css';
import './styles/utilities.css';

import './components/ui/style/ui.css';
import './components/ui/style/form-field.css';
import './components/ui/style/data-table.css';
import './components/ui/style/modal-shell.css';

// نقطه ورود برنامه React
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BusinessDataProvider>
      <App />
    </BusinessDataProvider>
  </React.StrictMode>
);
