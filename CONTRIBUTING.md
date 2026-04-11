# Contributing to Gratonite

Thanks for contributing to Gratonite.

## Code of Conduct

By participating in this project, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before You Start

- Check [existing issues](https://github.com/CoodayeA/Gratonite/issues) before opening a new one.
- For substantial features or architectural changes, open an issue first so the approach can be aligned before you invest time in implementation.
- Keep changes scoped. Small, reviewable pull requests are easier to merge safely.

## Prerequisites

- Node.js 22 recommended
- PostgreSQL 16+
- Redis 7+
- `pnpm` 9+ for the API/workspace
- `npm` 10+ for web, mobile, desktop, and server apps

## Repository Layout

```text
Gratonite/
├── apps/
│   ├── api/       Express + TypeScript backend
│   ├── web/       React + Vite web client
│   ├── mobile/    Expo / React Native app
│   ├── desktop/   Electron chat client
│   ├── server/    Tauri self-hosting desktop app
│   ├── landing/   Next.js marketing site
│   └── relay/     Federation relay server
├── deploy/        Production and self-host deployment configs
├── packages/      Shared workspace packages
└── docs/          Product, self-hosting, launch, and API docs
```

## Local Development

Gratonite is a mixed-package-manager monorepo.

- `apps/api` uses `pnpm`
- `apps/web`, `apps/mobile`, `apps/desktop`, and `apps/server` use `npm`

### API

```bash
cd apps/api
cp .env.example .env
pnpm install
pnpm run db:migrate
pnpm run dev
```

### Web

```bash
cd apps/web
cp .env.example .env
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:4000` in `apps/web/.env` for local development.

### Mobile

```bash
cd apps/mobile
npm install
npm run start
```

### Desktop

```bash
cd apps/desktop
npm install
npm run dev
```

### Server App

```bash
cd apps/server
npm install
npm run dev
```

## Pull Requests

1. Branch from `main`.
2. Make the smallest correct change.
3. Run verification for the surfaces you touched.
4. Update docs when public behavior, contributor workflow, deploy behavior, or release flow changes.
5. Open a pull request against `main` with a clear description of the change and its user impact.

### Recommended Verification

For API changes:

```bash
cd apps/api
pnpm run verify:prod
```

For web changes:

```bash
cd apps/web
npm run verify:prod
```

For desktop changes:

```bash
cd apps/desktop
npm test
```

If your change affects multiple surfaces, run the relevant checks for each one.

## Coding Conventions

- Use TypeScript throughout; avoid `any` unless there is a clear reason.
- Follow existing patterns in the area you are changing instead of introducing a new style.
- Keep route/domain logic close to the existing files that own it.
- Prefer small, focused changes over broad refactors.
- Keep public docs in sync with real behavior.

## Database Changes

If your change requires a schema change:

1. Update the relevant schema files under `apps/api/src/db/schema/`.
2. Generate a migration from `apps/api`:

```bash
pnpm run db:generate
```

3. Apply it locally:

```bash
pnpm run db:migrate
```

4. Include the generated migration under `apps/api/drizzle/` in your PR.

## Commit Messages

We use Conventional Commits where practical:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `refactor:` refactoring without behavior change
- `test:` tests added or updated
- `chore:` maintenance

## License

By contributing, you agree that your contributions will be licensed under the [AGPLv3 License](LICENSE).
