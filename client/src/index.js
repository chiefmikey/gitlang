import 'airbnb-browser-shims';
import 'the-new-css-reset/css/reset.css';
import './styles.css';

import App from './components/App.svelte';

const app = new App({
  target: document.querySelector('#app'),
});

export default app;
