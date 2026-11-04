# invi

A small, mobile-first frontend for an [Invidious](https://invidious.io) server, built with Angular.
It runs as one extra container next to Invidious and uses Invidious' own `/api/v1`.

- Subscriptions, trending, search, channels, playlists, comments, history
- Adaptive video quality, captions, resume where you stopped
- Preview thumbnails on the timeline, speed and quality menus that remember your choice, YouTube's keyboard
  shortcuts (space/k, j/l, arrows, m, f, c, < and >, 0–9)
- Always the original audio, never YouTube's AI dubs
- Watch positions that follow you from device to device, and a "Watch on YouTube" link at the
  current time
- Sign in with your Invidious account
- Light and dark, made for the phone first

## How it works

1. The container is nginx. It serves the built Angular app.
2. It also proxies Invidious' paths (`/api`, `/companion`, `/vi`, `/ggpht`, `/sb`, `/videoplayback`)
   to `INVIDIOUS_URL`. So the app only talks to its own origin. That matters for sign-in: a token
   header sent to another origin fails Invidious' CORS preflight.
3. Video plays through Invidious' DASH manifest with shaka-player. If that fails, it falls back
   to the 360p file.
4. A small Node server in the same container (`server/main.mjs`, no dependencies) keeps watch
   positions per user in `/data/positions.json`, behind `/invi-api/`. It accepts a request when
   Invidious accepts its token. Invidious can't say whose token it is, so the username comes from
   sign-in: on a shared Invidious, one signed-in user could write another's positions.
5. Sign-in uses Invidious' token flow. The app sends you to `INVIDIOUS_PUBLIC_URL/authorize_token`.
   You sign in there and allow a token with a few scopes. Invidious sends you back to
   `/auth/callback`, and the token is kept in the browser.

Paths copy YouTube's (`/watch?v=…`, `/channel/…`, `/@handle`, `/playlist?list=…`,
`/results?search_query=…`). Swap the host in a YouTube link and it opens here.

## Settings

| Variable               | Meaning                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `INVIDIOUS_URL`        | Where the container reaches Invidious (`http://invidious:3000`). |
| `INVIDIOUS_PUBLIC_URL` | Where the browser reaches Invidious, for sign-in. Required.      |

## Run it

[`docker-compose.yml`](docker-compose.yml) is a complete example: Invidious, Invidious companion,
Postgres and invi. If you already run Invidious, add only the `invi` service to your compose file:

```yaml
invi:
  image: kalinkasolutions/invi:latest
  restart: unless-stopped
  ports:
    - "127.0.0.1:8080:8080"
  environment:
    INVIDIOUS_URL: http://invidious:3000
    INVIDIOUS_PUBLIC_URL: https://invidious.example.com
  volumes:
    - invi-data:/data
```

and `invi-data:` under `volumes:` at the end of the file. Then put a hostname for invi behind your reverse proxy, pointing at port 8080.

## Limits

- **Live streams** may not play behind Invidious companion: in testing, it returned no HLS stream
  for them. The app then says so instead of loading forever.
- **History search** only finds videos watched in this app on the same device. Invidious keeps
  just the ids of watched videos, and looking up every title would mean one YouTube request each.

## Develop

```sh
INVIDIOUS_URL=https://invidious.example.com npm start
```

This serves the app on port 4200 and proxies the Invidious paths to that server.
`npm test` runs the app's unit tests, `npm run test:server` the position server's.

## Release

Publishing a GitHub release builds the image and pushes it to Docker Hub as `<tag>` and `latest`
(`.github/workflows/docker-publish.yml`). It needs the repository secrets `DOCKER_HUB_USERNAME`
and `DOCKER_HUB_API_TOKEN`.
