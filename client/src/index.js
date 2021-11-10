import App from './components/App.svelte';
import 'airbnb-browser-shims';

const app = new App({
  target: document.querySelector('#app'),
});

export default app;
