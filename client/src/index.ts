import 'the-new-css-reset/css/reset.css';
import './styles.scss';

import { mount } from 'svelte';

import App from './components/App.svelte';

const target = document.querySelector('.app');

if (target === null) {
  throw new Error('Could not find .app element');
}

const app = mount(App, { target });

export default app;
