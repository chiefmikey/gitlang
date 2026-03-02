# GitLang - Claude Code Instructions

## What This Is

GitLang (gitlang.net) shows programming language usage stats for any GitHub user, organization, or repo. Users type a username and see animated percentage bars for each language.

## Architecture

**Two-server split:**
- **Client** (port 8080): Koa static server → `public/` with SPA fallback
- **API** (port 3000): Koa API server → GitHub REST API via Octokit

**Production:**
- Client: AWS S3 + CloudFront (us-east-2)
- Server: EC2 via AWS CodeDeploy

## Key Directories

```
client/src/components/   # Svelte components (App, Input, Card, Results, Progress, ScrollTop, Footer)
client/lib/data/         # Data fetching, parsing, aggregation
server/helpers/github/   # Octokit wrappers (repositories, languages, rateLimit, tokenManager, auth)
server/requests/         # Koa router endpoints
local/                   # Local dev servers (client.ts, server.ts)
public/                  # Static assets, built bundle
.github/workflows/       # CI/CD (client deploy, server deploy, auto-merge)
```

## Commands

```bash
npm run build:dev     # Development build with watch mode
npm run build:prod    # Production build
npm run start:client  # Start client dev server (port 8080)
npm run start:server  # Start API dev server (port 3000)
npm run fix           # ESLint autofix
```

## Tech Stack

- **Frontend:** Svelte 5 (using Svelte 4 syntax for compatibility), SCSS, Webpack 5
- **Backend:** Koa 3, @koa/router, @octokit/rest
- **Auth:** GitHub PAT via env var (supports multiple comma-separated tokens) with AWS Secrets Manager fallback
- **Build:** Webpack 5 + Babel + svelte-loader + svelte-preprocess

## Input Formats

- `username` — all repos for a user
- `username/repo` — single repo
- `username/repo1,repo2,repo3` — multiple repos
- `@org` or `org:name` or `org/name` — organization
- `user1+user2` — multiple users aggregated (space in input → + in URL)

## Key Conventions

- **DO NOT change the animation or UI design** — it's intentionally crafted
- Svelte components use Svelte 4 syntax (export let, on:click, $:) for consistency
- API routes are prefixed `/gitlang/github/`
- Token management supports multiple PATs with rate-limit-aware rotation
- Fork inclusion is optional (default: excluded)
- Language bars are clickable to show per-repo breakdown (when multiple repos)

## Environment Variables

- `GH_PAT` — GitHub Personal Access Token(s), comma-separated for multi-token rotation
- `NODE_ENV` — development or production

## API Endpoints

- `GET /gitlang/github/repos?username=X&includeForks=true|false`
- `GET /gitlang/github/langs?owner=X&repos=[...]`
- `GET /gitlang/github/rate-limit`
