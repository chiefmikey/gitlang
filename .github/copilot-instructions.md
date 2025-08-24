# GitLang - GitHub Language Usage Viewer

GitLang is a TypeScript/Svelte web application that displays programming language usage statistics for GitHub repositories and users. It consists of a Svelte frontend with a Node.js/Koa backend API.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Dependencies and Setup
- Install Node.js and npm (validated with Node.js runtime)
- Clone the repository: `git clone https://github.com/chiefmikey/gitlang.git`
- Install dependencies: `npm install` -- takes 35-45 seconds. NEVER CANCEL.
- Create `.env` file in project root with: `GITHUB_PAT=your_github_personal_access_token`
  - GitHub PAT requires `public_repo` scope for API access
  - Without valid PAT, API calls will fail with authentication errors

### Build Commands
- Development build: `npm run build:dev` -- takes 3-5 seconds initially, then runs in watch mode. NEVER CANCEL the watch process.
- Production build: `npm run build:prod` -- takes 8-12 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
- Build output: Creates `public/dist/bundle.js` (production ~275KB, development ~1.2MB)

### Development Servers
- Start API server: `npm run start:server` -- starts on port 3000, ready in 1-2 seconds
- Start client server: `npm run start:client` -- starts on port 8080, ready in 1-2 seconds  
- ALWAYS start the server BEFORE the client for full functionality
- Both servers must run simultaneously for complete application functionality

### Code Quality
- Lint and auto-fix: `npm run fix` -- takes 10-15 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
- Known linting issues: 21 warnings (mostly missing return types), 1 SCSS parsing error
- Linting does not block builds or functionality

### Security Updates
- Run `npm audit fix` to address 13 known vulnerabilities (mix of moderate, high, critical)
- Vulnerabilities are in dependencies (@babel, @octokit, axios, koa, etc.) with available fixes
- Always run `npm audit fix` after `npm install` before starting development

## Validation Scenarios

### Basic Application Testing
- Navigate to `http://localhost:8080` after starting both servers
- Verify GitLang logo and input form are visible
- Test search functionality:
  - Enter username (e.g., "chiefmikey") in input field
  - Click Submit button
  - URL should change to `/username` format
  - With valid GITHUB_PAT: displays language usage charts
  - Without valid GITHUB_PAT: shows "Loading..." with console errors (expected)

### Manual Validation Requirements
- ALWAYS test both development and production builds after making changes
- ALWAYS verify both servers start without errors
- ALWAYS test the search form functionality as described above
- Take screenshots of UI changes to verify visual impact
- Monitor browser console for API errors when testing with invalid/test tokens

## Repository Structure

### Key Directories
- `/client/` - Svelte frontend application
  - `/client/src/` - Main application code
  - `/client/lib/` - Data fetching and utility functions
- `/server/` - Koa backend API  
  - `/server/helpers/` - GitHub API integration
  - `/server/requests/` - API route handlers
- `/local/` - Local development server configurations
- `/public/` - Static assets and build output (`dist/` contains webpack bundles)
- `/.github/workflows/` - CI/CD for client (S3/CloudFront) and server (AWS CodeDeploy)

### Important Files
- `package.json` - npm scripts and dependencies
- `webpack.config.ts` - Build configuration for client bundle  
- `tsconfig.json` - TypeScript configuration
- `.env` - Environment variables (GITHUB_PAT, not tracked in git)
- `CONTRIBUTING.md` - Development setup documentation

### API Endpoints
- `GET /gitlang/github/repos?username=X` - Fetch user repositories
- `GET /gitlang/github/langs?owner=X&repos=[]` - Fetch language statistics
- Authentication via `GITHUB_PAT` environment variable or AWS Secrets Manager

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
- Server deployment: Uses AWS CodeDeploy via `.github/workflows/server.yml`  
- Always run `npm run fix` before committing to avoid CI lint failures
- Build artifacts are automatically generated and deployed on push to main branch

## Common Issues and Solutions
- **CORS errors in browser**: Expected when using invalid/test GITHUB_PAT
- **"Loading..." stuck on page**: Indicates API authentication failure, check GITHUB_PAT
- **Lint warnings about return types**: Non-blocking, fix if modifying those files
- **webpack bundle size warnings**: Expected, application bundle is legitimately large
- **Security vulnerabilities**: Run `npm audit fix` to resolve most dependency issues

## Development Workflow
1. Always run `npm install && npm audit fix` first
2. Create/verify `.env` file with valid GITHUB_PAT
3. Build the application: `npm run build:prod` (or `npm run build:dev` for watch mode)
4. Start servers: `npm run start:server` then `npm run start:client`
5. Test functionality at `http://localhost:8080`
6. Run `npm run fix` before committing changes
7. Always manually validate UI changes and functionality