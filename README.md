# STEAMLabs Code Clubs

A management system for STEAMLabs Africa's code clubs in Kenya: schools, clubs, club champions, learners, consent, session reports and attendance, events, reports, equipment, a resource library and learner progress. It is one installable web app (PWA) for laptops, tablets and phones, in English and Kiswahili. Club Champions and Coordinators can keep working with no internet; changes sync when the device is back online.

**Status:** Sprint 5 (equipment, resource library and learner progress) built and in review. Sprints 1 to 4 are merged. Data is stored in MongoDB (decision D1-8). Demo mode lets you click through the app without a database. Use fictional learners only until STEAMLabs confirms its data protection registration (R2-1).

## Documentation

- [Architecture](docs/architecture.md): stack, diagrams, modules, data model, roles and security
- [Coding principles](docs/coding-principles.md)
- [Decision log](docs/decision-log.md) (`D<sprint>-<n>`)
- [Risk register](docs/risk-register.md) (`R<sprint>-<n>`)
- [Sprint 1 plan](docs/sprints/sprint-1.md): user stories, permissions, API, definition of done
- [Sprint 1 data layer](docs/sprints/sprint-1-data-layer.md): MongoDB collections, indexes and scope queries
- [Sprint 2 plan](docs/sprints/sprint-2.md) and [summary](docs/sprints/sprint-2-summary.md): learners, consent, sessions and attendance
- [Sprint 3 plan](docs/sprints/sprint-3.md) and [summary](docs/sprints/sprint-3-summary.md): working offline and sync
- [Sprint 4 plan](docs/sprints/sprint-4.md) and [summary](docs/sprints/sprint-4-summary.md): HQ dashboard, alerts, termly reports, events and announcements
- [Sprint 5 plan](docs/sprints/sprint-5.md) and [summary](docs/sprints/sprint-5-summary.md): equipment, resource library, projects and assessments
- [Kiswahili review list](docs/kiswahili-review.md): every Kiswahili text beside the English, for a native speaker to check
- [Sync protocol](docs/sync-protocol.md): how devices and the server exchange changes

## Project layout

```text
shared/   enums, role/permission policy, Zod schemas (used by client and server)
server/   Express API (/api/v1): auth, users, schools, clubs, audit
client/   React + Vite PWA built with the STEAMLabs UI kit (steamlabsui)
docs/     architecture, principles, decisions, risks, sprints
```

## Setup on Windows

You need:

1. **Node.js 24 LTS** from <https://nodejs.org> (choose the LTS installer). Node 22.12 or newer also works.
2. **Git** from <https://git-scm.com/download/win>.
3. **MongoDB** (D1-8). Either:
   - **MongoDB Atlas free tier (recommended, D1-23):** create a free cluster at <https://www.mongodb.com/cloud/atlas>, add a database user, allow your IP address, and copy the connection string (`mongodb+srv://…`). Add `/code-clubs` before the `?` so the data goes into its own database.
   - **MongoDB Community Server** installed on your computer: the connection string is `mongodb://localhost:27017/code-clubs`.

Then, in **PowerShell**:

```powershell
git clone https://github.com/tonuiiii-tech/code-clubs-management-system.git
cd code-clubs-management-system
npm install

Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

Open `server\.env` in a text editor. Set `MONGODB_URI` to your connection string, and set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to two different long random strings. You can generate one with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Load the fictional demo data (the same schools, clubs and people as demo mode; safe to run again):

```powershell
npm run seed
```

Start the API and the web app together:

```powershell
npm run dev
```

- Web app: <http://localhost:5173>
- API health check: <http://localhost:4000/api/v1/health>
- Sign in with a seeded account, e.g. `wanjiru.kamau@demo.steamlabs.test` (System Administrator), with the demo password `demo-password-2026` (or `SEED_DEFAULT_PASSWORD` if you set one).

On macOS or Linux, use `cp` instead of `Copy-Item` and `/` instead of `\`.

In **Git Bash**, use `cp` and `/` the same way, and the project folder is `/c/Users/<you>/…`.

### If something goes wrong

| What you see                                                            | Cause and fix                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invalid environment configuration … JWT_ACCESS_SECRET`                 | A secret is missing or shorter than 32 characters. Generate a new one with the command above. Older `.env` files used `JWT_SECRET`; the names are now `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.                                                                                                                                                               |
| `Invalid scheme, expected connection string to start with "mongodb://"` | The `MONGODB_URI` line is wrong, e.g. the name typed twice (`MONGODB_URI=MONGODB_URI=…`) or the old name `MONGO_URI`.                                                                                                                                                                                                                                             |
| `MongooseServerSelectionError … IP that isn't whitelisted`              | Atlas does not allow your IP address. Add it in Atlas under Security → Network Access. Home and mobile internet in Kenya often change IP; for development only you can allow `0.0.0.0/0`, and remove it before going live.                                                                                                                                        |
| "Cannot reach the server" on the sign-in page                           | The API is not running, or is still starting. Keep the `npm run dev` window open and wait for `Code Clubs API listening on http://localhost:4000/api/v1`. Check `PORT=4000` in `server\.env` (the web app calls port 4000), and that nothing else is using port 4000. Open the app at exactly `http://localhost:5173`, which is the address `CORS_ORIGIN` allows. |

### Demo mode (no database needed)

To click through every screen without setting up MongoDB, run the web app in demo mode:

```powershell
npm run demo
```

Open <http://localhost:5173> and use the **Sign in as…** buttons to try each role. Demo mode uses an in-browser mock API with fictional Kenyan schools, clubs and people, stored only in that browser. **Reset demo data** on the sign-in page puts it back to the start. The mock code is left out of real builds.

## Commands

| Command                                      | What it does                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                                | API and web app with live reload                                                                                                           |
| `npm run demo`                               | Web app only, on the mock API with fictional demo data                                                                                     |
| `npm test`                                   | Server tests (Jest + Supertest) and client tests (Vitest)                                                                                  |
| `npm run lint`                               | ESLint across all workspaces                                                                                                               |
| `npm run format`                             | Format with Prettier                                                                                                                       |
| `npm run build`                              | Production build of the PWA                                                                                                                |
| `npm run test:e2e -w client`                 | Playwright browser tests on the demo build (run `npx playwright install chromium` once first)                                              |
| `E2E_TARGET=real npm run test:e2e -w client` | The same browser tests against the real API and the MongoDB in `MONGODB_URI` (seed it first; Git Bash syntax). CI runs this on every push. |
| `npm run seed`                               | Load the fictional demo data into MongoDB (refuses to run in production)                                                                   |
| `npm run load-test -w server`                | Fill a database whose name ends in `_loadtest` with 300 clubs and 9,000 fictional learners and time the heaviest requests                  |
| `npm run i18n:review -w client`              | Rebuild the Kiswahili review list in `docs/kiswahili-review.md`                                                                            |

CI runs lint, format check, tests and build on every push and pull request (`.github/workflows/ci.yml`).

## Online demo (Vercel)

The repository deploys to Vercel as the **demo build** (D3-10): the whole app runs in the browser with fictional data and no server, so it is safe to share with stakeholders. `vercel.json` holds the settings. In the Vercel project:

1. **Settings → Build and Deployment → Root Directory:** leave it empty (the repository root), so `vercel.json` is used.
2. Leave the framework, install, build and output settings on their defaults; `vercel.json` overrides them.
3. On the free Hobby plan, Vercel can refuse to deploy commits whose author is not the account owner. If a pull request preview fails within seconds, that is the likely cause; merges into `main` are authored by you and deploy.

No environment variables or secrets are needed.

## Rules for contributors

- Never commit `.env` files, secrets or real personal data. Seed data is fictional.
- Every protected API route checks the role permission **and** the record's school/club scope on the server.
- All UI text goes through `react-i18next` with keys in both `en` and `sw`.
- Build screens from `steamlabsui` components.
- See [docs/coding-principles.md](docs/coding-principles.md) for the full list and the definition of done.
