import assert from 'node:assert/strict';
import { test } from 'node:test';

import { conditionFromCode, createOpenMeteoClient } from '../src/weather-client';

/**
 * A stand-in for `fetch` that answers from a canned payload and records the
 * URLs it was asked for. Nothing in this file reaches the network: the real
 * `openMeteoClient` is never imported.
 */
function fakeFetch(payload: unknown, init: { ok?: boolean; status?: number } = {}) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      statusText: init.status === 503 ? 'Service Unavailable' : 'OK',
      json: async () => payload,
    };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const CURRENT_PAYLOAD = { current: { temperature_2m: 18.4, weather_code: 0 } };

const CURRENT_PAYLOAD_WITH_WIND = {
  current: { temperature_2m: 18.4, weather_code: 0, wind_speed_10m: 11.7 },
};

const DAILY_PAYLOAD = {
  daily: {
    time: ['2026-07-28', '2026-07-29'],
    temperature_2m_max: [22.1, 19.8],
    temperature_2m_min: [13.6, 12.4],
    weather_code: [0, 61],
  },
};

test('current() maps the API payload onto CurrentWeather', async () => {
  const { impl, calls } = fakeFetch(CURRENT_PAYLOAD);
  const result = await createOpenMeteoClient(impl).current(37.7749, -122.4194);

  assert.deepEqual(result, { tempC: 18.4, condition: 'Clear' });
  assert.equal(calls.length, 1);
  assert.match(calls[0] ?? '', /latitude=37\.7749&longitude=-122\.4194/);
  assert.match(calls[0] ?? '', /current=temperature_2m,weather_code,wind_speed_10m/);
});

test('current() maps wind_speed_10m onto windKph when present', async () => {
  const { impl, calls } = fakeFetch(CURRENT_PAYLOAD_WITH_WIND);
  const result = await createOpenMeteoClient(impl).current(0, 0);

  assert.equal(result.windKph, 11.7);
  assert.equal(result.tempC, 18.4);
  assert.match(calls[0] ?? '', /wind_speed_10m/);
});

test('current() degrades gracefully when wind_speed_10m is absent', async () => {
  const { impl } = fakeFetch(CURRENT_PAYLOAD);
  const result = await createOpenMeteoClient(impl).current(0, 0);

  assert.equal(result.tempC, 18.4);
  assert.equal(result.windKph, undefined);
  assert.equal('windKph' in result, false);
});

test('forecast() maps each day, including its condition', async () => {
  const { impl, calls } = fakeFetch(DAILY_PAYLOAD);
  const days = await createOpenMeteoClient(impl).forecast(37.7749, -122.4194, 2);

  assert.deepEqual(days, [
    { date: '2026-07-28', highC: 22.1, lowC: 13.6, condition: 'Clear' },
    { date: '2026-07-29', highC: 19.8, lowC: 12.4, condition: 'Rain' },
  ]);
  assert.match(calls[0] ?? '', /forecast_days=2/);
});

test('a day missing a temperature bound is dropped, not rendered as a gap', async () => {
  const { impl } = fakeFetch({
    daily: {
      time: ['2026-07-28', '2026-07-29'],
      temperature_2m_max: [22.1],
      temperature_2m_min: [13.6],
      weather_code: [0, 61],
    },
  });
  const days = await createOpenMeteoClient(impl).forecast(0, 0, 2);
  assert.equal(days.length, 1);
  assert.equal(days[0]?.date, '2026-07-28');
});

test('an empty daily block yields no days rather than throwing', async () => {
  const { impl } = fakeFetch({});
  assert.deepEqual(await createOpenMeteoClient(impl).forecast(0, 0, 3), []);
});

test('a non-OK response rejects with the status in the message', async () => {
  const { impl } = fakeFetch({}, { ok: false, status: 503 });
  await assert.rejects(
    () => createOpenMeteoClient(impl).current(0, 0),
    /weather request failed: 503/,
  );
});

test('a response with no current temperature rejects rather than rendering NaN', async () => {
  const { impl } = fakeFetch({ current: { weather_code: 0 } });
  await assert.rejects(() => createOpenMeteoClient(impl).current(0, 0), /no current temperature/);
});

test('WMO codes map to conditions, with a fallback for unknown codes', () => {
  assert.equal(conditionFromCode(0), 'Clear');
  assert.equal(conditionFromCode(2), 'Partly cloudy');
  assert.equal(conditionFromCode(48), 'Fog');
  assert.equal(conditionFromCode(81), 'Rain');
  assert.equal(conditionFromCode(95), 'Thunderstorm');
  assert.equal(conditionFromCode(-1), 'Unknown');
});
