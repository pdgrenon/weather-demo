/**
 * App entry point — the only place the real network client is constructed.
 */

import './style.css';
import { renderView, type ViewState } from './render';
import { openMeteoClient, type WeatherClient } from './weather-client';

/** Fixed for now; a location picker is a natural next feature. */
const PLACE = { name: 'New York City', lat: 40.7128, lon: -74.006 } as const;

const FORECAST_DAYS = 3;

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
  } catch (err) {
    paint({
      kind: 'error',
      message: err instanceof Error ? err.message : 'Something went wrong.',
    });
  }
}

const mount = document.querySelector<HTMLElement>('#app');
if (mount) void boot(mount, openMeteoClient);
