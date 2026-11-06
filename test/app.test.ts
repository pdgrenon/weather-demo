import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { boot, PLACE } from '../src/app';
import type { CurrentWeather, DailyForecast, WeatherClient } from '../src/weather-client';

/**
 * `boot()` sets `document.body.dataset.sky`, and Node has no `document`. This
 * is the smallest stand-in that satisfies it; a fresh one per test keeps the
 * tests independent.
 */
let body: { dataset: Record<string, string> };
beforeEach(() => {
  body = { dataset: {} };
  (globalThis as { document?: unknown }).document = { body };
});

/**
 * A stand-in for the `#app` element. It records every HTML string painted
 * into it, and answers `querySelector('[data-sky]')` from the latest one —
 * the only DOM read `boot()` makes.
 */
function fakeMount() {
  const painted: string[] = [];
  const mount = {
    set innerHTML(html: string) {
      painted.push(html);
    },
    get innerHTML() {
      return painted.at(-1) ?? '';
    },
    querySelector(selector: string) {
      assert.equal(selector, '[data-sky]');
      const sky = /data-sky="([^"]*)"/.exec(painted.at(-1) ?? '')?.[1];
      return sky === undefined ? null : { getAttribute: () => sky };
    },
  };
  return { mount: mount as unknown as HTMLElement, painted };
}

const CURRENT: CurrentWeather = { tempC: 18.4, condition: 'Rain', windKph: 11.7 };
const FORECAST: DailyForecast[] = [
  { date: '2020-01-01', highC: 22.1, lowC: 13.6, condition: 'Clear' },
  { date: '2020-01-02', highC: 19.8, lowC: 12.4, condition: 'Rain' },
];

/** A canned weather client. Nothing here reaches the network. */
function fakeClient(answer: {
  current?: () => Promise<CurrentWeather>;
  forecast?: () => Promise<DailyForecast[]>;
} = {}) {
  const calls: { method: string; lat: number; lon: number }[] = [];
  const client: WeatherClient = {
    current(lat, lon) {
      calls.push({ method: 'current', lat, lon });
      return answer.current?.() ?? Promise.resolve(CURRENT);
    },
    forecast(lat, lon) {
      calls.push({ method: 'forecast', lat, lon });
      return answer.forecast?.() ?? Promise.resolve(FORECAST);
    },
  };
  return { client, calls };
}

test('boot paints the loading state before the weather arrives', async () => {
  const { mount, painted } = fakeMount();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const { client } = fakeClient({ current: () => gate.then(() => CURRENT) });

  const done = boot(mount, client);
  assert.equal(painted.length, 1);
  assert.match(painted[0] ?? '', /data-state="loading"/);
  assert.equal(body.dataset['sky'], 'neutral');

  release();
  await done;
  assert.match(painted.at(-1) ?? '', /data-state="loaded"/);
});

test('boot asks for the weather at the configured place', async () => {
  const { mount } = fakeMount();
  const { client, calls } = fakeClient();
  await boot(mount, client);
  assert.deepEqual(
    calls.map((c) => [c.method, c.lat, c.lon]).sort(),
    [
      ['current', PLACE.lat, PLACE.lon],
      ['forecast', PLACE.lat, PLACE.lon],
    ],
  );
});

test('boot renders the loaded view with the temperature, wind and forecast', async () => {
  const { mount, painted } = fakeMount();
  const { client } = fakeClient();
  await boot(mount, client);

  const html = painted.at(-1) ?? '';
  assert.match(html, /data-state="loaded"/);
  assert.match(html, /New York City/);
  assert.match(html, /class="temperature"/);
  assert.match(html, /Wind 12 km\/h/);
  assert.equal(html.match(/class="day"/g)?.length, FORECAST.length);
});

test('boot copies the card backdrop onto the page body', async () => {
  const { mount, painted } = fakeMount();
  const { client } = fakeClient();
  await boot(mount, client);
  assert.match(painted.at(-1) ?? '', /data-sky="rain"/);
  assert.equal(body.dataset['sky'], 'rain');
});

test('boot shows the empty state when the service has no forecast', async () => {
  const { mount, painted } = fakeMount();
  const { client } = fakeClient({ forecast: () => Promise.resolve([]) });
  await boot(mount, client);
  assert.match(painted.at(-1) ?? '', /data-state="empty"/);
  assert.match(painted.at(-1) ?? '', /No forecast available/);
  assert.equal(body.dataset['sky'], 'neutral');
});

test('boot shows the error state, not the raw error, when the service fails', async () => {
  const { mount, painted } = fakeMount();
  const { client } = fakeClient({
    current: () => Promise.reject(new Error('weather request failed: 503 <b>oops</b>')),
  });
  await boot(mount, client);
  const html = painted.at(-1) ?? '';
  assert.match(html, /data-state="error"/);
  assert.match(html, /We couldn't reach the weather service just now/);
  assert.doesNotMatch(html, /503|oops/);
  assert.equal(body.dataset['sky'], 'neutral');
});
