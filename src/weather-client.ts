/**
 * The weather data boundary.
 *
 * Everything that touches the network lives behind `WeatherClient`. The app
 * builds the real client once, in `main.ts`; tests construct their own object
 * literal instead, so the test suite never makes an HTTP request.
 */

export interface CurrentWeather {
  tempC: number;
  condition: string;
}

export interface DailyForecast {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  highC: number;
  lowC: number;
  condition: string;
}

export interface WeatherClient {
  current(lat: number, lon: number): Promise<CurrentWeather>;
  forecast(lat: number, lon: number, days: number): Promise<DailyForecast[]>;
}

/**
 * WMO weather-interpretation codes, which is what Open-Meteo reports, grouped
 * into the handful of conditions this app actually distinguishes.
 * https://open-meteo.com/en/docs — "Weather variable documentation".
 */
const CONDITIONS: ReadonlyArray<readonly [codes: readonly number[], label: string]> = [
  [[0], 'Clear'],
  [[1, 2], 'Partly cloudy'],
  [[3], 'Overcast'],
  [[45, 48], 'Fog'],
  [[51, 53, 55, 56, 57], 'Drizzle'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain'],
  [[71, 73, 75, 77, 85, 86], 'Snow'],
  [[95, 96, 99], 'Thunderstorm'],
];

/** Human-readable label for a WMO code. Unrecognised codes fall back to `Unknown`. */
export function conditionFromCode(code: number): string {
  for (const [codes, label] of CONDITIONS) {
    if (codes.includes(code)) return label;
  }
  return 'Unknown';
}

const API_ROOT = 'https://api.open-meteo.com/v1/forecast';

interface CurrentResponse {
  current?: { temperature_2m?: number; weather_code?: number };
}

interface DailyResponse {
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
  };
}

async function getJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`weather request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

/**
 * Build a client backed by the live Open-Meteo API — free, and no API key.
 *
 * `fetchImpl` is injected so the response-parsing logic can be covered without
 * a network call; production callers use the default.
 */
export function createOpenMeteoClient(fetchImpl: typeof fetch = fetch): WeatherClient {
  return {
    async current(lat, lon) {
      const url = `${API_ROOT}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
      const body = await getJson<CurrentResponse>(fetchImpl, url);
      const temp = body.current?.temperature_2m;
      if (typeof temp !== 'number') {
        throw new Error('weather response had no current temperature');
      }
      return { tempC: temp, condition: conditionFromCode(body.current?.weather_code ?? -1) };
    },

    async forecast(lat, lon, days) {
      const url =
        `${API_ROOT}?latitude=${lat}&longitude=${lon}&forecast_days=${days}` +
        `&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
      const daily = (await getJson<DailyResponse>(fetchImpl, url)).daily;
      const dates = daily?.time ?? [];
      const out: DailyForecast[] = [];
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const highC = daily?.temperature_2m_max?.[i];
        const lowC = daily?.temperature_2m_min?.[i];
        // A day missing either bound is dropped rather than rendered as a gap.
        if (date === undefined || typeof highC !== 'number' || typeof lowC !== 'number') continue;
        out.push({
          date,
          highC,
          lowC,
          condition: conditionFromCode(daily?.weather_code?.[i] ?? -1),
        });
      }
      return out;
    },
  };
}

/** The client the running app uses. Never imported by tests. */
export const openMeteoClient: WeatherClient = createOpenMeteoClient();
