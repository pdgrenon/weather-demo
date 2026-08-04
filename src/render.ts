/**
 * View rendering.
 *
 * Every function here is pure: state in, HTML string out. Nothing touches the
 * DOM, so the whole view layer is testable without a browser environment.
 */

import type { CurrentWeather, DailyForecast } from './weather-client';

export type ViewState =
  | { kind: 'loading' }
  | { kind: 'loaded'; place: string; current: CurrentWeather; forecast: DailyForecast[] }
  | { kind: 'empty'; place: string }
  | { kind: 'error'; message: string };

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

/** Whole degrees Celsius. The demo has no unit toggle yet. */
export function formatTemp(celsius: number): string {
  return `${Math.round(celsius)}°`;
}

/** Wind speed for display, rounded to whole km/h. */
export function formatWind(kph: number): string {
  return `${Math.round(kph)} km/h`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Short weekday for an ISO `YYYY-MM-DD` date. Parsed as UTC deliberately: a
 * local-time parse would render a different day either side of midnight
 * depending on the viewer's timezone.
 */
export function formatDay(isoDate: string, now: Date = new Date()): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  const day = parsed.getUTCDay();
  if (Number.isNaN(day)) return isoDate;

  const asUtcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = (asUtcDay(parsed) - asUtcDay(now)) / 86_400_000;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return WEEKDAYS[day] ?? isoDate;
}

/**
 * Condition → backdrop key. Drives the page gradient via `[data-sky]` in
 * `style.css`; unknown conditions get the neutral backdrop.
 */
export function skyFor(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('clear')) return 'clear';
  if (c.includes('partly')) return 'partly';
  if (c.includes('overcast') || c.includes('fog')) return 'grey';
  if (c.includes('thunder')) return 'storm';
  if (c.includes('rain') || c.includes('drizzle')) return 'rain';
  if (c.includes('snow')) return 'snow';
  return 'neutral';
}

function shell(state: string, sky: string, body: string): string {
  return `<section class="card" data-state="${state}" data-sky="${sky}">${body}</section>`;
}

function forecastList(days: readonly DailyForecast[]): string {
  const items = days
    .map(
      (d) => `
      <li class="day">
        <span class="day-name">${escapeHtml(formatDay(d.date))}</span>
        <span class="day-condition">${escapeHtml(d.condition)}</span>
        <span class="day-range">
          <strong>${escapeHtml(formatTemp(d.highC))}</strong>
          <span class="day-low">${escapeHtml(formatTemp(d.lowC))}</span>
        </span>
      </li>`,
    )
    .join('');
  return `<ul class="forecast">${items}</ul>`;
}

export function renderView(state: ViewState): string {
  switch (state.kind) {
    case 'loading':
      return shell(
        'loading',
        'neutral',
        `<p class="status">Getting the latest conditions…</p>`,
      );

    case 'error':
      return shell(
        'error',
        'neutral',
        `<h1 class="place">Weather unavailable</h1>
         <p class="status">We couldn't reach the weather service just now.</p>
         <p class="hint">This is usually temporary — try reloading in a moment.</p>`,
      );

    case 'empty':
      return shell(
        'empty',
        'neutral',
        `<h1 class="place">${escapeHtml(state.place)}</h1>
         <p class="status">No forecast available right now.</p>
         <p class="hint">Conditions should return shortly — try reloading.</p>`,
      );

    case 'loaded':
      return shell(
        'loaded',
        skyFor(state.current.condition),
        `<h1 class="place">${escapeHtml(state.place)}</h1>
         <p class="temperature">${escapeHtml(formatTemp(state.current.tempC))}</p>
         <p class="condition">${escapeHtml(state.current.condition)}</p>
         ${state.current.windKph === undefined ? '' : `<p class="wind">Wind ${escapeHtml(formatWind(state.current.windKph))}</p>`}
         ${forecastList(state.forecast)}`,
      );
  }
}
