import 'the-new-css-reset/css/reset.css';
import './styles.scss';

import { mount } from 'svelte';

import App from './components/App.svelte';

const app = mount(App, {
  target: document.querySelector('.app') as Element,
});

export default app;
