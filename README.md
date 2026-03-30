# StudyHub

StudyHub is now deployment-ready (uploadable) as a Node web app.

## Local Run

1. Install dependencies

```bash
npm install
```

2. Start server

```bash
npm start
```

3. Open app

http://localhost:3000/index.html

## Production / Upload Deployment

This project serves frontend + API from one Node service.

- Start command: `npm start`
- Health endpoint: `GET /api/health`
- Required Node version: `22+`

### Data Storage

The app stores data in SQLite and supports a configurable storage location via env var:

- `STUDYHUB_DATA_DIR` (optional)

If not provided, storage defaults to `data/` inside the project.

For cloud hosting, set `STUDYHUB_DATA_DIR` to a persistent disk path.

## Render (one-click style)

This repo includes `render.yaml`.

1. Push this project to GitHub.
2. In Render, create a new Blueprint from that repo.
3. Render will read `render.yaml`, create the web service, and attach a persistent disk.
4. Open your app URL after deploy.

## Any Other Node Host (Railway, Fly.io, VPS)

Use these settings:

- Build command: `npm install`
- Start command: `npm start`
- Environment:
  - `NODE_ENV=production`
  - `STUDYHUB_DATA_DIR=<persistent-path>`

## API Notes

- `POST /api/semesters/:id/subjects` accepts `{subjects: [{name, details}, ...]}`.
- `PUT /api/data` replaces full payload.
- `GET /api/health` returns service status.

## Backup Behavior

- DB backups are auto-created on writes.
- Retention keeps the newest 20 backups.

## PowerShell Tip

If script execution policy blocks npm, use:

```powershell
npm.cmd install
npm.cmd start
```
