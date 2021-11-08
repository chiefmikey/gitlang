import App from './components/App.svelte';
import 'airbnb-browser-shims';

const app = new App({
  target: document.getElementById('app'),
});

export default app;
