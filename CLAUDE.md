# GitLang - Claude Code Instructions

## What This Is

GitLang (gitlang.net) shows programming language usage stats for any GitHub user, organization, or repo. Users type a username and see animated percentage bars for each language.

## Architecture

**Local dev (two servers):**
- **Client** (port 8080): Koa static server → `public/` with SPA fallback
- **API** (port 3000): Koa API server → GitHub REST API via Octokit

**Production (single CloudFront distribution):**
- Client: S3 origin → `gitlang.net/*`
- API: Lambda Function URL origin → `gitlang.net/gitlang/github/*`
- Region: us-east-2
- Infrastructure as Code: SAM template at `infra/template.yaml`

## Key Directories

```
client/src/components/   # Svelte components (App, Input, Card, Results, Progress, ScrollTop, Footer)
client/lib/data/         # Data fetching, parsing, aggregation
server/helpers/github/   # Octokit wrappers (repositories, languages, rateLimit, tokenManager, auth)
server/requests/         # Koa router endpoints (local dev)
server/lambda.ts         # AWS Lambda handler (production)
infra/                   # SAM template
local/                   # Local dev servers (client.ts, server.ts)
public/                  # Static assets, built bundle
.github/workflows/       # CI/CD (client deploy → S3, server deploy → Lambda)
```

## Commands

```bash
npm run build:dev     # Development build with watch mode
npm run build:prod    # Production build (client)
npm run build:lambda  # Production build (API Lambda bundle)
npm run start:client  # Start client dev server (port 8080)
npm run start:server  # Start API dev server (port 3000)
npm run fix           # ESLint autofix
```

## Tech Stack

- **Frontend:** Svelte 5 (using Svelte 4 syntax for compatibility), SCSS, Webpack 5
- **Backend:** AWS Lambda (Node.js 20, arm64) with @octokit/rest; Koa 3 for local dev
- **Auth:** GitHub App (GitLang Stats, App ID 2992472) → auto-rotating installation tokens via @octokit/auth-app. Credentials in AWS Secrets Manager (`AUTH_GITLANG`)
- **Build:** Webpack 5 + Babel + svelte-loader (client), esbuild (Lambda)

## Input Formats

- `username` — all repos for a user
- `username/repo` — single repo
- `username/repo1,repo2,repo3` — multiple repos
- `@org` or `org:name` or `org/name` — organization
- `user1+user2` — multiple users aggregated (space in input → + in URL)
- `user1~user2` — compare mode (side-by-side groups, ? in input → ~ in URL)
- `user/repo@author` — contributor mode (language stats for specific author's commits)

## Key Conventions

- **DO NOT change the animation or UI design** — it's intentionally crafted
- Svelte components use Svelte 4 syntax (export let, on:click, $:) for consistency
- API routes are prefixed `/gitlang/github/`
- Auth uses GitHub App with auto-rotating installation tokens (no manual rotation needed)
- Forks are always excluded — language stats reflect repos owned by the user
- Language bars are clickable anywhere to show per-repo breakdown (when multiple repos)

## Environment Variables

- `NODE_ENV` — development or production
- `GH_APP_ID` — (optional) GitHub App ID, overrides Secrets Manager
- `GH_INSTALLATION_ID` — (optional) GitHub App Installation ID
- `GH_PRIVATE_KEY` — (optional) GitHub App private key PEM

## API Endpoints

- `GET /gitlang/github/merged?username=X` — combined repos + langs in one call (primary endpoint, GraphQL-backed, cached 5min)
- `GET /gitlang/github/repos?username=X`
- `GET /gitlang/github/langs?owner=X&repos=[...]`
- `GET /gitlang/github/rate-limit`
- `GET /gitlang/github/contributors?owner=X&repo=Y`
- `GET /gitlang/github/contributor-langs?owner=X&repo=Y&author=Z`

## Deployment

- **Client:** Push to main → GitHub Actions → S3 sync + CloudFront invalidation
- **API:** Push to main (server/** changes) → GitHub Actions → esbuild bundle → SAM deploy to Lambda
- **CloudFront:** Single distribution routes `/gitlang/github/*` → Lambda, `*` → S3
