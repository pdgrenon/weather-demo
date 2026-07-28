import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  escapeHtml,
  formatDay,
  formatTemp,
  renderView,
  skyFor,
  type ViewState,
} from '../src/render';

const CURRENT = { tempC: 18.4, condition: 'Clear' };
const FORECAST = [
  { date: '2026-07-28', highC: 22.1, lowC: 13.6, condition: 'Clear' },
  { date: '2026-07-29', highC: 19.8, lowC: 12.4, condition: 'Rain' },
];

function stateFor(kind: ViewState['kind']): ViewState {
  switch (kind) {
    case 'loading':
      return { kind: 'loading' };
    case 'loaded':
      return { kind: 'loaded', place: 'San Francisco', current: CURRENT, forecast: FORECAST };
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

test('an error renders the reason and stays visible — never a blank page', () => {
  const html = renderView(stateFor('error'));
  assert.match(html, /Weather unavailable/);
  assert.match(html, /network unreachable/);
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

test('text from the data source is escaped, not injected as markup', () => {
  const html = renderView({ kind: 'error', message: '<img src=x onerror="alert(1)">' });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.equal(escapeHtml(`a & b < c > d " e ' f`), 'a &amp; b &lt; c &gt; d &quot; e &#39; f');
});

test('temperatures render as whole degrees', () => {
  assert.equal(formatTemp(18.4), '18°');
  assert.equal(formatTemp(-0.6), '-1°');
});

test('weekdays are derived in UTC so they do not shift with the viewer timezone', () => {
  assert.equal(formatDay('2026-07-28'), 'Tue');
  assert.equal(formatDay('not-a-date'), 'not-a-date');
});

test('conditions map to backdrops, with a neutral fallback', () => {
  assert.equal(skyFor('Clear'), 'clear');
  assert.equal(skyFor('Partly cloudy'), 'partly');
  assert.equal(skyFor('Drizzle'), 'rain');
  assert.equal(skyFor('Thunderstorm'), 'storm');
  assert.equal(skyFor('Unknown'), 'neutral');
});
