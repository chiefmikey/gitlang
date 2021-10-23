import smoothscroll from '../../node_modules/smoothscroll-polyfill/dist/smoothscroll.js';
import App from './components/App.svelte';

smoothscroll.polyfill();

const app = new App({
  target: document.getElementById('app'),
});

export default app;
