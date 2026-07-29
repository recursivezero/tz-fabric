# TZ-Fabric frontend

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm 10 or newer

## Development

```sh
npm ci
npm run dev
```

Copy `.env.sample` to `.env` and configure the documented `VITE_` variables.
The development proxy target can be changed with `VITE_API_PROXY_TARGET`.

## Quality checks

```sh
npm run lint
npm test
npm run build
```

## Production preview process

Build first, then serve the generated `dist` directory on port 5173:

```sh
npm run build
npm start
```

`npm start` is intended for the repository's existing PM2 deployment workflow.
A dedicated static web server or CDN is preferable for a larger production setup.
