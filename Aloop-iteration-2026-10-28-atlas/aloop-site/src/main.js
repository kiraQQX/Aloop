import { createApp } from 'vue';
import App from './App.vue';
// Reuse the same stylesheets as standalone.html so the Vue shell and the
// single-file reference share one visual system instead of two near-copies.
import '../assets/css/tokens.css';
import '../assets/css/base.css';
import '../assets/css/topbar.css';
import '../assets/css/theme-blue.css';
import '../assets/css/revision3.css';
import './style.css';

createApp(App).mount('#app');
