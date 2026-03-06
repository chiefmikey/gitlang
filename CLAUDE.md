# GitLang - Claude Code Instructions

## Project Overview
GitLang (gitlang.net) shows programming language usage stats for any GitHub user, organization, or repo. Users type a username and see animated percentage bars for each language.

## Tech Stack
- **Frontend:** Svelte 5 (using Svelte 4 syntax), SCSS, Webpack 5 + Babel + svelte-loader
- **Backend:** AWS Lambda (Node.js 22, arm64) with @octokit/rest; Koa 3 for local dev
- **Auth:** GitHub App (GitLang Stats) with auto-rotating installation tokens via @octokit/auth-app
- **Testing:** Vitest + @testing-library/svelte (unit), Playwright (e2e)
- **Linting:** ESLint via `@mikey-pro/eslint-config-svelte`, Prettier, Stylelint (local `.stylelintrc.cjs`)

## Architecture
```
client/src/components/   # Svelte components (App, Input, Card, Results, Progress, ScrollTop, Footer)
client/lib/data/         # Data fetching, parsing, aggregation
server/helpers/github/   # Octokit wrappers (repositories, languages, rateLimit, tokenManager, auth)
server/requests/         # Koa router endpoints (local dev)
server/lambda.ts         # AWS Lambda handler (production)
infra/                   # SAM template
local/                   # Local dev servers (client.ts, server.ts)
public/                  # Static assets, built bundle
tests/                   # client/, server/, e2e/, setup/
```

## Commands
```bash
npm run build:dev     # Development build with watch
npm run build:prod    # Production build (client)
npm run build:lambda  # Production build (API Lambda bundle, esbuild)
npm run start:client  # Client dev server (port 8080)
npm run start:server  # API dev server (port 3000)
npm run fix           # ESLint autofix
npm test              # Vitest (unit tests)
npm run test:e2e      # Playwright e2e tests
npm run test:coverage # Vitest with V8 coverage
```

## Input Formats
- `username` — all repos | `username/repo` — single repo | `username/repo1,repo2` — multiple repos
- `@org` or `org:name` — organization | `user1+user2` — aggregated | `user1~user2` — compare mode
- `user/repo@author` — contributor mode (language stats for specific author's commits)

## Conventions
- **DO NOT change the animation or UI design** — intentionally crafted
- Svelte components use Svelte 4 syntax (export let, on:click, $:) with a Vite plugin to strip `<template>` wrappers
- API routes prefixed `/gitlang/github/`; primary endpoint: `GET /merged?username=X` (GraphQL-backed, cached 5min)
- Forks always excluded
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`

## Deployment
- **Client:** Push to main -> GitHub Actions -> S3 sync + CloudFront invalidation
- **API:** Push to main (server/** changes) -> esbuild bundle -> SAM deploy to Lambda
- **CloudFront:** Single distribution routes `/gitlang/github/*` -> Lambda, `*` -> S3

## Testing
- **Unit:** Vitest + jsdom + @testing-library/svelte (`tests/client/`, `tests/server/`)
- **E2E:** Playwright (`tests/e2e/`)
- **Run:** `npm test`, `npm run test:e2e`, `npm run test:coverage`
