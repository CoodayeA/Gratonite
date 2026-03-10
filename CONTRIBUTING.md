# Contributing to Gratonite

Thank you for your interest in contributing to Gratonite! This guide will help you get started.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis
- pnpm 9+

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/<your-username>/Gratonite.git
   cd Gratonite
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your local database credentials and settings
   ```

4. **Set up the database**

   ```bash
   pnpm db:migrate
   ```

5. **Start the development servers**

   ```bash
   pnpm dev
   ```

   This starts both the API server and web client in development mode.

### Project Structure

```
Gratonite/
├── apps/
│   ├── api/          # Node.js/Express backend
│   ├── web/          # React/Vite frontend
│   ├── desktop/      # Electron desktop app
│   ├── mobile/       # React Native mobile app
│   └── landing/      # Marketing site
├── packages/         # Shared packages
├── deploy/           # Deployment configs
│   └── self-host/    # Self-hosting guide
└── docs/             # Documentation
```

## How to Contribute

### Reporting Bugs

- Check [existing issues](https://github.com/CoodayeA/Gratonite/issues) first
- Use the bug report template
- Include steps to reproduce, expected behavior, and actual behavior
- Include browser/OS version for frontend bugs

### Suggesting Features

- Open a [discussion](https://github.com/CoodayeA/Gratonite/discussions) first
- Describe the problem your feature would solve
- Propose your solution and any alternatives you've considered

### Pull Requests

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards (below)

3. **Test your changes**:
   ```bash
   pnpm typecheck    # TypeScript checks
   pnpm lint         # Linting
   ```

4. **Commit with a clear message**:
   ```bash
   git commit -m "feat: add user profile badges"
   ```
   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation changes
   - `refactor:` code refactoring
   - `test:` adding/updating tests
   - `chore:` maintenance tasks

5. **Push and open a PR** against `main`

### Coding Standards

- **TypeScript**: All code must be typed. Avoid `any` where possible.
- **Express 5**: `req.params` fields are `string | string[]` — always cast: `req.params.id as string`
- **Formatting**: We use Prettier defaults. Run `pnpm format` before committing.
- **Naming**: camelCase for variables/functions, PascalCase for components/types, snake_case for database columns.
- **Database**: Use Drizzle ORM for queries. Migrations go in `apps/api/src/db/migrations/`.

### Database Migrations

If your change requires a database schema change:

1. Create a new migration file in `apps/api/src/db/migrations/`
2. Use sequential numbering: `NNNN_description.sql`
3. Include both the migration SQL and update the Drizzle schema in `apps/api/src/db/schema.ts`

## License

By contributing, you agree that your contributions will be licensed under the [AGPLv3 License](LICENSE).
