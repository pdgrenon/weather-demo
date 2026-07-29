# Weather

A small web page that shows the current temperature and a five-day forecast
for New York City. It fetches live data from [Open-Meteo](https://open-meteo.com),
a free weather service that needs no account or API key.

The page has four states, and you'll see all of them in normal use: a brief
**loading** message while the data is on its way, the **forecast** itself once
it arrives, an **empty** message if the service has no forecast to give, and a
plain-language **error** if it can't be reached at all. It never shows a blank
page.

The backdrop changes with the weather — clear skies look different from rain.

## Running it on your own machine

You'll need [Node.js](https://nodejs.org) version 22 or newer. In a terminal,
from this folder:

```
npm install     # download the tools it needs, once
npm run dev     # start it up
```

That prints a web address (usually <http://localhost:5173>) — open it in a
browser and the app is running. Press `Ctrl-C` in the terminal to stop it.

## The other commands

| Command         | What it does                                                    |
| --------------- | --------------------------------------------------------------- |
| `npm test`      | Runs the automated checks. No internet needed — the tests use canned data. |
| `npm run build` | Produces the finished files for publishing, in a `dist` folder.  |
| `npm run preview` | Serves that finished build locally, so you can check it before publishing. |

Every change goes through `npm test` and `npm run build` automatically before
it can be merged.

## How it's put together

| File                   | What lives there                                          |
| ---------------------- | --------------------------------------------------------- |
| `src/weather-client.ts` | Everything that talks to the weather service.             |
| `src/render.ts`         | Turns weather data into the page's HTML. No network here. |
| `src/main.ts`           | Starts the app and connects those two.                    |
| `src/style.css`         | How it looks.                                             |

Keeping the network code in one file is deliberate: it means the rest of the
app — and all of its tests — can run against made-up weather instead of waiting
on a real service. That's why the tests are fast and never fail because the
internet was slow.
