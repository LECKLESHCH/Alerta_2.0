import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import "./i18n";
import logoMini from './assets/images/logo-mini.png';
import * as serviceWorker from './serviceWorker';

document.title = 'ALERTA';

const favicon =
  document.querySelector("link[rel='shortcut icon']") ||
  document.querySelector("link[rel='icon']");

if (favicon) {
  favicon.href = logoMini;
}

ReactDOM.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
, document.getElementById('root'));

serviceWorker.unregister();
