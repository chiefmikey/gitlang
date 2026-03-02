# GitLang - GitHub Language Usage Viewer

GitLang is a TypeScript/Svelte web application that displays programming language usage statistics for GitHub repositories and users. It consists of a Svelte frontend with a Node.js backend API.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Dependencies and Setup
- Install Node.js and npm (validated with Node.js runtime)
- Clone the repository: `git clone https://github.com/chiefmikey/gitlang.git`
- Install dependencies: `npm install` -- takes 35-45 seconds. NEVER CANCEL.
- Auth is handled by a GitHub App (GitLang Stats). Credentials are stored in AWS Secrets Manager (`AUTH_GITLANG`). No local `.env` needed for auth.

### Build Commands
- Development build: `npm run build:dev` -- takes 3-5 seconds initially, then runs in watch mode. NEVER CANCEL the watch process.
- Production build: `npm run build:prod` -- takes 8-12 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
- Lambda build: `npm run build:lambda` -- bundles the API Lambda handler via esbuild.
- Build output: Creates `public/dist/bundle.js` (client) and `dist/lambda/index.mjs` (API)

### Development Servers
- Start API server: `npm run start:server` -- starts on port 3000, ready in 1-2 seconds
- Start client server: `npm run start:client` -- starts on port 8080, ready in 1-2 seconds
- ALWAYS start the server BEFORE the client for full functionality
- Both servers must run simultaneously for complete application functionality

### Code Quality
- Lint and auto-fix: `npm run fix` -- takes 10-15 seconds. NEVER CANCEL. Set timeout to 30+ seconds.

## Validation Scenarios

### Basic Application Testing
- Navigate to `http://localhost:8080` after starting both servers
- Verify GitLang logo and input form are visible
- Test search functionality:
  - Enter username (e.g., "chiefmikey") in input field
  - Click Submit button
  - URL should change to `/username` format
  - Should display language usage charts

### Manual Validation Requirements
- ALWAYS test both development and production builds after making changes
- ALWAYS verify both servers start without errors
- ALWAYS test the search form functionality as described above
- Monitor browser console for API errors

## Repository Structure

### Key Directories
- `/client/` - Svelte frontend application
  - `/client/src/` - Main application code
  - `/client/lib/` - Data fetching and utility functions
- `/server/` - Backend API
  - `/server/helpers/` - GitHub API integration (auth, repositories, languages, contributors, rateLimit)
  - `/server/requests/` - Koa router endpoints (local dev)
  - `/server/lambda.ts` - AWS Lambda handler (production)
- `/infra/` - SAM template for Lambda deployment
- `/local/` - Local development server configurations
- `/public/` - Static assets and build output (`dist/` contains webpack bundles)
- `/.github/workflows/` - CI/CD for client (S3/CloudFront) and server (SAM/Lambda)

### Important Files
- `package.json` - npm scripts and dependencies
- `webpack.config.ts` - Build configuration for client bundle
- `tsconfig.json` - TypeScript configuration
- `infra/template.yaml` - SAM template for Lambda deployment

### API Endpoints
- `GET /gitlang/github/repos?username=X&includeForks=true|false` - Fetch user repositories
- `GET /gitlang/github/langs?owner=X&repos=[...]` - Fetch language statistics
- `GET /gitlang/github/rate-limit` - Check GitHub API rate limit
- `GET /gitlang/github/contributors?owner=X&repo=Y` - List repo contributors
- `GET /gitlang/github/contributor-langs?owner=X&repo=Y&author=Z` - Language stats per contributor
- Authentication via GitHub App (auto-rotating installation tokens from AWS Secrets Manager)

## Build Timing and Timeouts
- **CRITICAL**: Set timeout to 60+ seconds for ALL build commands
- **NEVER CANCEL** any build, lint, or install commands
- npm install: 35-45 seconds
- Production build: 8-12 seconds
- Development build: 3-5 seconds (initial), then watch mode
- Linting: 10-15 seconds
- Server startup: 1-2 seconds each

## CI/CD Integration
- Client deployment: Builds and deploys to AWS S3/CloudFront via `.github/workflows/client.yml`
- Server deployment: Bundles Lambda and deploys via SAM in `.github/workflows/server.yml`
- Always run `npm run fix` before committing to avoid CI lint failures
- Build artifacts are automatically generated and deployed on push to main branch

## Architecture (Production)
- Single CloudFront distribution at `gitlang.net`
- Client: S3 origin for `/*`
- API: Lambda Function URL origin for `/gitlang/github/*`
- Same-origin architecture (no CORS needed)
- Region: us-east-2

## Development Workflow
1. Always run `npm install` first
2. Build the application: `npm run build:prod` (or `npm run build:dev` for watch mode)
3. Start servers: `npm run start:server` then `npm run start:client`
4. Test functionality at `http://localhost:8080`
5. Run `npm run fix` before committing changes
6. Always manually validate UI changes and functionality
