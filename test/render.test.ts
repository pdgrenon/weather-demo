import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  celsiusToFahrenheit,
  escapeHtml,
  formatDay,
  formatTemp,
  formatWind,
  renderView,
  skyFor,
  unitForLocale,
  type ViewState,
} from '../src/render';

const CURRENT = { tempC: 18.4, condition: 'Clear', windKph: 11.7 };
const FORECAST = [
  { date: '2026-08-11', highC: 22.1, lowC: 13.6, condition: 'Clear' },
  { date: '2026-08-12', highC: 19.8, lowC: 12.4, condition: 'Rain' },
];

function stateFor(kind: ViewState['kind']): ViewState {
  switch (kind) {
    case 'loading':
      return { kind: 'loading' };
    case 'loaded':
      return { kind: 'loaded', place: 'San Francisco', current: CURRENT, forecast: FORECAST, unit: 'C' };
    case 'empty':
      return { kind: 'empty', place: 'San Francisco' };
    case 'error':
      return { kind: 'error', message: 'network unreachable' };
  }
}

test('every view state is identifiable by its data-state hook', () => {
  for (const kind of ['loading', 'loaded', 'empty', 'error'] as const) {
    assert.match(renderView(stateFor(kind)), new RegExp(`data-state="${kind}"`));
  }
});

test('each state renders distinct user-facing copy', () => {
  const bodies = (['loading', 'loaded', 'empty', 'error'] as const).map((k) =>
    renderView(stateFor(k)),
  );
  assert.equal(new Set(bodies).size, 4);
});

test('a loaded view renders the temperature and every forecast day', () => {
  const html = renderView(stateFor('loaded'));
  assert.match(html, /18°/);
  assert.match(html, /Clear/);
  assert.match(html, /Tue/);
  assert.match(html, /22°/);
  assert.match(html, /Wed/);
  assert.match(html, /20°/);
});

test('a loaded view picks the backdrop from the current condition', () => {
  assert.match(renderView(stateFor('loaded')), /data-sky="clear"/);
});

test('an error stays visible with a human-readable message — never a blank page', () => {
  const html = renderView(stateFor('error'));
  assert.match(html, /Weather unavailable/);
  assert.match(html, /We couldn't reach the weather service just now/);
  assert.ok(html.trim().length > 0);
});

test('an empty forecast renders the empty state, not an empty loaded card', () => {
  const html = renderView(stateFor('empty'));
  assert.match(html, /No forecast available/);
  assert.doesNotMatch(html, /class="forecast"/);
});

test('the loading state is what renders before any data resolves', () => {
  assert.match(renderView({ kind: 'loading' }), /Getting the latest conditions/);
});

test('the error card never renders the raw message payload — stronger than escaping', () => {
  const html = renderView({ kind: 'error', message: '<img src=x onerror="alert(1)">' });
  assert.doesNotMatch(html, /<img src=x onerror="alert\(1\)">/);
  assert.equal(escapeHtml(`a & b < c > d " e ' f`), 'a &amp; b &lt; c &gt; d &quot; e &#39; f');
});

test('temperatures render as whole degrees', () => {
  assert.equal(formatTemp(18.4, 'C'), '18°C');
  assert.equal(formatTemp(-0.6, 'C'), '-1°C');
});

test('celsiusToFahrenheit converts at the freezing and boiling points', () => {
  assert.equal(celsiusToFahrenheit(0), 32);
  assert.equal(celsiusToFahrenheit(100), 212);
});

test('formatTemp renders in Fahrenheit when requested', () => {
  assert.equal(formatTemp(18.4, 'F'), '65°F');
  assert.equal(formatTemp(-0.6, 'F'), '31°F');
});

test('unitForLocale detects US vs non-US locales', () => {
  assert.equal(unitForLocale('en-US'), 'F');
  assert.equal(unitForLocale('es-US'), 'F');
  assert.equal(unitForLocale('en-GB'), 'C');
  assert.equal(unitForLocale('fr-FR'), 'C');
  assert.equal(unitForLocale(''), 'C');
});

test('wind speeds render as whole km/h', () => {
  assert.equal(formatWind(11.7), '12 km/h');
  assert.equal(formatWind(0.3), '0 km/h');
});

test('a loaded view with windKph renders the wind', () => {
  const html = renderView(stateFor('loaded'));
  assert.match(html, /Wind 12 km\/h/);
});

test('a loaded view without windKph contains no wind element', () => {
  const html = renderView({ kind: 'loaded', place: 'Test', current: { tempC: 22, condition: 'Clear' }, forecast: [], unit: 'C' });
  assert.doesNotMatch(html, /Wind/);
  assert.doesNotMatch(html, /<p class="wind">/);
});

test('weekdays are derived in UTC so they do not shift with the viewer timezone', () => {
  assert.equal(formatDay('2026-07-28', new Date('2026-06-01T12:00:00Z')), 'Tue');
  assert.equal(formatDay('not-a-date'), 'not-a-date');
  assert.equal(formatDay('not-a-date', new Date('2026-07-28T12:00:00Z')), 'not-a-date');
  assert.equal(formatDay('2026-07-28', new Date('2026-07-28T12:00:00Z')), 'Today');
  assert.equal(formatDay('2026-07-29', new Date('2026-07-28T12:00:00Z')), 'Tomorrow');
  assert.equal(formatDay('2026-07-30', new Date('2026-07-28T12:00:00Z')), 'Thu');
  assert.equal(formatDay('2026-07-29', new Date('2026-07-29T00:30:00Z')), 'Today');
  assert.equal(formatDay('2026-07-29', new Date('2026-07-28T23:30:00Z')), 'Tomorrow');
});

test('conditions map to backdrops, with a neutral fallback', () => {
  assert.equal(skyFor('Clear'), 'clear');
  assert.equal(skyFor('Partly cloudy'), 'partly');
  assert.equal(skyFor('Drizzle'), 'rain');
  assert.equal(skyFor('Thunderstorm'), 'storm');
  assert.equal(skyFor('Unknown'), 'neutral');
});
