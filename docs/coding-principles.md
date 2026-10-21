# Coding Principles

**Project:** STEAMLabs Africa Code Clubs Management System  
**Applies from:** Sprint 1
**Last updated:** 2026-10-21

## 1. General principles

1. Prefer readable, maintainable code over clever shortcuts.
2. Keep each module focused on one business responsibility.
3. Use consistent naming, formatting, and error handling.
4. Avoid premature abstractions, but isolate areas expected to change, such as API access and authorization policies.
5. Keep pull requests small enough to review.
6. Update documentation when behavior, API contracts, or architecture decisions change.

## 2. Repository and workspaces

- Use npm workspaces for `client`, `server`, and `shared`.
- Give `shared` its own `package.json` and explicit package exports.
- Use clear, stable import paths; avoid fragile deep relative imports across workspaces.
- Keep client and server environment variables separate.
- Commit `.env.example` files with placeholder values only.
- Never commit `.env`, credentials, API keys, tokens, or real user data.

## 3. JavaScript and React

- Use consistent ES modules across the project where supported by the chosen setup.
- Prefer `const`; use `let` only when reassignment is needed.
- Use descriptive names and small functions.
- Keep React components focused on rendering and UI interaction.
- Put API calls in `client/src/services/`, not directly throughout page components.
- Keep business rules out of presentation components.
- Build UI from `steamlabsui` components and tokens; follow its brand rules (Fuel Yellow carries dark text; white on Clover Green only for large text).
- Put every user-facing string through react-i18next (`t('…')`), with keys in both `en` and `sw` files. No hard-coded UI text.
- Show loading, empty, success, and error states for data-driven pages.
- Make forms keyboard accessible and provide clear validation messages.
- Do not treat hidden navigation items or disabled buttons as security controls.

## 4. Backend structure

Each module should separate:

- **Routes:** endpoint definitions and middleware composition.
- **Controllers:** request/response translation.
- **Services:** business rules, authorization scope, and orchestration.
- **Repositories:** the only code that reads or writes the database, so the engine choice (D1-8) stays in one place.
- **Models / schema:** persistence structure and database constraints.

Controllers should remain thin. Do not put complex business rules directly in routes or controllers.

## 5. Validation

- Use Zod schemas from `shared/` for reusable data-shape validation.
- Validate all untrusted request bodies, query parameters, and route parameters on the server.
- Do not assume client-side validation is sufficient.
- Keep authorization and database-dependent checks in server code.
- Return useful validation errors without leaking implementation details.

## 6. Authentication and authorization

- Authenticate every protected request on the server.
- Enforce role permissions and resource scope on the server.
- Check the requested resource's school/club assignment before returning or changing it.
- Deny by default when a permission or scope is missing.
- Never allow users to set their own role or privileged assignment through a general profile update.
- Invalidate or reject sessions for deactivated accounts.
- Add tests for both allowed and denied operations.

## 7. Database and data integrity

- Normalize emails before uniqueness checks.
- Use database indexes for uniqueness and common lookup paths.
- Do not permanently delete operational records when history must be retained.
- Use server-controlled timestamps for authoritative audit and update times.
- Do not trust client-supplied role, ownership, audit actor, or authorization fields.
- Keep seed data fictional and clearly marked for development.

## 8. API conventions

- Prefix API routes with `/api/v1`.
- Use consistent JSON response and error formats.
- Use appropriate HTTP status codes.
- Do not return password hashes, tokens, or internal exception details.
- Keep list endpoints scoped and consider pagination as records grow.
- Make state-changing operations explicit and validate allowed transitions.

## 9. Audit logging

Log security-sensitive and administrative events, including account creation/deactivation, role changes, school changes, club changes, and champion assignments.

Audit entries should identify the actor, action, entity, and timestamp. Do not log passwords, session tokens, or entire request bodies by default.

## 10. Testing

- Write unit tests for service-level business rules.
- Use Jest and Supertest for API tests, and Vitest for client units.
- Use an isolated, in-process test database; never point automated tests at a shared or production database.
- Test permission denial and cross-school/cross-club access.
- Test inactive users, malformed input, missing records, and duplicate records.
- Keep tests deterministic and independent.
- CI must run linting, tests, and production builds on pushes and pull requests.

## 11. Accessibility, language, and UI

- Use semantic HTML and accessible labels.
- Ensure important workflows work with keyboard navigation.
- English and Kiswahili from day one with react-i18next; English is the default and the fallback for any missing Kiswahili key.
- Kiswahili translations are reviewed by a fluent speaker before release.
- Self-host the Poppins font (open licence, SIL OFL) instead of loading it from Google Fonts, so the app looks right without internet.
- Respect the steamlabsui contrast rules and check forms with an accessibility checker (axe) in Playwright.

## 12. Offline-readiness without premature implementation

In Sprints 1 and 2:

- Keep API access behind a service layer.
- Use UUIDs that a device can generate; never assume only the server creates IDs.
- Deactivate records instead of deleting them.
- Do not add incomplete sync logic to ordinary CRUD endpoints.

In Sprint 3:

- Design idempotent synchronization, scoped change feeds, conflict handling, tombstones, retries, and resynchronization.
- Treat IndexedDB contents as potentially accessible on a shared device.
- Never trust offline client permissions when syncing back to the server.

## 13. Definition of done for code changes

A change is done when:

- it meets the user story and acceptance criteria;
- validation and authorization are implemented server-side;
- relevant tests pass;
- lint and build checks pass;
- loading, empty, and error states are handled where relevant;
- documentation is updated when needed;
- no secrets or real personal data are committed;
- user-facing text exists in English and Kiswahili files;
- UI uses steamlabsui components rather than one-off styling.
