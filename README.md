# STEAMLabs Code Clubs

A management system for STEAMLabs Africa's code clubs in Kenya: schools, clubs, club champions, and later learners, sessions, attendance, events and reports. It is one installable web app (PWA) for laptops, tablets and phones, in English and Kiswahili. Offline use with sync comes in Sprint 3.

**Status:** Sprint 1. The database is MongoDB (decision D1-8, 22 Oct). Until the MongoDB data layer is built, API routes that read or save data return `501 Not Implemented`; use demo mode to click through the app.

## Documentation

- [Architecture](docs/architecture.md): stack, diagrams, modules, data model, roles and security
- [Coding principles](docs/coding-principles.md)
- [Decision log](docs/decision-log.md) (`D<sprint>-<n>`)
- [Risk register](docs/risk-register.md) (`R<sprint>-<n>`)
- [Sprint 1 plan](docs/sprints/sprint-1.md): user stories, permissions, API, definition of done

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
3. A database is **not** needed yet. MongoDB setup steps (D1-8) will be added here with the data layer.

Then, in **PowerShell**:

```powershell
git clone https://github.com/tonuiiii-tech/code-clubs-management-system.git
cd code-clubs-management-system
npm install

Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

Open `server\.env` in a text editor and set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to two different long random strings. You can generate one with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Start the API and the web app together:

```powershell
npm run dev
```

- Web app: <http://localhost:5173>
- API health check: <http://localhost:4000/api/v1/health>

On macOS or Linux, use `cp` instead of `Copy-Item` and `/` instead of `\`.

### Demo mode (no database needed)

Until the MongoDB data layer is built (D1-8), the API answers data requests with `501 Not implemented`. To click through every screen, run the web app in demo mode:

```powershell
npm run demo
```

Open <http://localhost:5173> and use the **Sign in as…** buttons to try each role. Demo mode uses an in-browser mock API with fictional Kenyan schools, clubs and people, stored only in that browser. **Reset demo data** on the sign-in page puts it back to the start. The mock code is left out of real builds.

## Commands

| Command                      | What it does                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`                | API and web app with live reload                                                              |
| `npm run demo`               | Web app only, on the mock API with fictional demo data                                        |
| `npm test`                   | Server tests (Jest + Supertest) and client tests (Vitest)                                     |
| `npm run lint`               | ESLint across all workspaces                                                                  |
| `npm run format`             | Format with Prettier                                                                          |
| `npm run build`              | Production build of the PWA                                                                   |
| `npm run test:e2e -w client` | Playwright browser tests on the demo build (run `npx playwright install chromium` once first) |
| `npm run seed`               | Development seed data (added once the database is chosen)                                     |

CI runs lint, format check, tests and build on every push and pull request (`.github/workflows/ci.yml`).

## Rules for contributors

- Never commit `.env` files, secrets or real personal data. Seed data is fictional.
- Every protected API route checks the role permission **and** the record's school/club scope on the server.
- All UI text goes through `react-i18next` with keys in both `en` and `sw`.
- Build screens from `steamlabsui` components.
- See [docs/coding-principles.md](docs/coding-principles.md) for the full list and the definition of done.
