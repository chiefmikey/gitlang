import 'the-new-css-reset/css/reset.css';
import './styles.scss';

import { capturePageView,initAnalytics } from '@mikl/analytics/vanilla';
import { mount } from 'svelte';

import App from './components/App.svelte';

initAnalytics();
capturePageView();

const target = document.querySelector('.app');

if (target === null) {
  throw new Error('Could not find .app element');
}

const app = mount(App, { target });

export default app;
