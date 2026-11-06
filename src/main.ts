/**
 * App entry point — the only place the real network client is constructed,
 * and the only file that touches the page on load. The behaviour itself lives
 * in `app.ts`.
 */

import './style.css';
import { boot } from './app';
import { openMeteoClient } from './weather-client';

const mount = document.querySelector<HTMLElement>('#app');
if (mount) void boot(mount, openMeteoClient);
