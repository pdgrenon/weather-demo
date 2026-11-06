/**
 * The app's behaviour: which place it shows, and how it moves between the
 * loading, loaded, empty and error states.
 *
 * Kept apart from `main.ts` so it can be tested: this file imports no CSS and
 * touches no globals at import time, and the weather client is passed in, so
 * tests drive `boot()` with canned data instead of the network.
 */

import { renderView, type ViewState } from './render';
import type { WeatherClient } from './weather-client';

/** Fixed for now; a location picker is a natural next feature. */
export const PLACE = { name: 'New York City', lat: 40.7128, lon: -74.006 } as const;

export const FORECAST_DAYS = 3;

export async function boot(
  mount: HTMLElement,
  client: WeatherClient,
  place: typeof PLACE = PLACE,
): Promise<void> {
  const paint = (state: ViewState) => {
    mount.innerHTML = renderView(state);
    document.body.dataset['sky'] =
      mount.querySelector('[data-sky]')?.getAttribute('data-sky') ?? 'neutral';
  };

  paint({ kind: 'loading' });

  try {
    const [current, forecast] = await Promise.all([
      client.current(place.lat, place.lon),
      client.forecast(place.lat, place.lon, FORECAST_DAYS),
    ]);
    paint(
      forecast.length === 0
        ? { kind: 'empty', place: place.name }
        : { kind: 'loaded', place: place.name, current, forecast },
    );
  } catch {
    paint({ kind: 'error' });
  }
}
