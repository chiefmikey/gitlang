# Plan: Modernize GitLang for 2026

_Status: COMPLETED_
_LastCompletedStep: 15_
_TotalSteps: 15_
_Created: 2026-03-01_
_Completed: 2026-03-01_
_Summary: All 15 steps + 4 post-plan tasks completed. Resolved merge conflicts, updated deps, fixed 4 bugs, implemented 9 new features (incl. compile/compare mode, contributor filtering, AWS Lambda rotation), removed SonarCloud, fixed CI/CD, closed all 14 open issues._

## Context

GitLang has fallen behind. It has 14 open GitHub issues (8 feature requests, 6 bugs), unresolved merge conflicts, outdated dependencies, no rate limit handling, and needs proper token management. The animation and UI are great and should NOT be changed — only functional improvements and dependency compatibility fixes.

## Steps

### Step 1: Resolve Merge Conflicts & Clean State
- Resolve `package-lock.json` merge conflict
- Clean up dependency list: remove unused `d3-interpolate`, `path`, `@types/dotenv-webpack`, `url-loader`
- Move `nodemon` from dependencies to devDependencies
- Add missing `prettier` and `stylelint` to devDependencies
- Stage and commit all pending changes (config files, component fixes, webpack changes)
- **Verify:** `git status` shows clean tree, `npm install` succeeds

### Step 2: Update All Dependencies to Latest
- Update production deps: `@aws-sdk/client-secrets-manager`, `@koa/router` (v14→v15), `svelte` (5.38→5.53), `axios`, `dotenv`, `koa`
- Update dev deps: `@babel/*`, `eslint-plugin-svelte`, `sass`, `typescript`, `webpack`, `webpack-cli`, `prettier-plugin-svelte` (v3→v5)
- Fix any breaking changes from @koa/router v15 and prettier-plugin-svelte v5
- **Verify:** `npm install` succeeds, `npm run build:prod` succeeds

### Step 3: Fix tsconfig.json & Build Config Cleanup
- Remove unused jsx/preact config from tsconfig.json (jsxFactory, jsxFragmentFactory)
- Verify webpack build still works after config changes
- **Verify:** `npm run build:prod` succeeds with no warnings

### Step 4: Fix "Loading..." When Not Found (Issue #104)
- In `Card.svelte`, the `Loading...` text shows when `data` is falsy (still fetching) but doesn't hide when the fetch returns empty results
- Fix: differentiate between "loading" (data is undefined) and "not found" (data is empty array)
- **Verify:** Build succeeds, manual test shows correct behavior

### Step 5: Implement Scroll Anywhere (Issue #88)
- The `.wrapper` div should capture scroll events regardless of where the cursor is on the page
- Add CSS `overflow-y: auto` to the wrapper and ensure scroll works from any position
- **Verify:** Build succeeds

### Step 6: API Rate Limit Validation (Issues #219, #92)
- Add a new server endpoint `GET /gitlang/github/rate-limit` that returns current rate limit status
- Before fetching repos, check rate limit — if insufficient remaining calls, return informative error
- Calculate: user needs 1 call for repos + N calls for languages (1 per repo)
- Surface rate limit info to client (remaining calls, reset time)
- **Verify:** Build succeeds, endpoint returns rate limit data

### Step 7: Multi-Token Support & Rotation
- Support multiple GitHub PATs via `GH_PAT` env var (comma-separated)
- Implement round-robin token selection with rate-limit-aware rotation
- When a token hits its rate limit, automatically switch to next available token
- Track per-token rate limits from response headers
- **Verify:** Build succeeds, server starts with single and multi-token configs

### Step 8: Option to Include Forks (Issue #89)
- Add a query parameter `includeForks` to the repos endpoint
- Update client to pass an `includeForks` option
- Add a small toggle/checkbox in the UI near the search input
- **Verify:** Build succeeds, toggle controls fork inclusion

### Step 9: Allow Multiple Repos Input (Issue #103)
- Update input parsing to support `username/repo1,repo2,repo3` format
- Handle URL encoding for the comma-separated format
- **Verify:** Build succeeds, multi-repo queries work

### Step 10: Allow Multiple Usernames Input (Issue #101)
- Update input parsing to support space-separated usernames: `user1 user2`
- Aggregate results across multiple users
- Handle URL encoding
- **Verify:** Build succeeds, multi-user queries work

### Step 11: Random Results Feature (Issue #105)
- Add "Random" button or link that fetches trending/random GitHub users
- Use GitHub search API to find popular users or repos
- Display results from a random selection
- **Verify:** Build succeeds, random button works

### Step 12: Language Repo Breakdown (Issue #325)
- Make language names in results clickable
- When clicked, show the list of repos using that language with per-repo percentages
- Store per-repo language data (already fetched, just not exposed to UI)
- Show as an expandable section below the language bar
- **Verify:** Build succeeds, clicking a language shows repo breakdown

### Step 13: Fix CI/CD Workflows (Issues #237, #230, #259)
- Add `concurrency` groups to client.yml and server.yml to prevent conflicting deploys
- Add condition to sonar.yml to skip closed PRs
- Use workflow concurrency with `cancel-in-progress: false` and `group: deploy`
- **Verify:** Workflow YAML is valid

### Step 14: Final Dependency Audit & Cleanup
- Run `npm audit` and fix any vulnerabilities
- Remove any remaining unused code
- Ensure all TypeScript is strict-mode clean
- **Verify:** `npm audit` clean, `npm run build:prod` succeeds, `npx eslint client/src server` passes

### Step 15: Documentation & Project CLAUDE.md
- Create project CLAUDE.md with architecture, commands, conventions
- Update docs/context/ with current state
- **Verify:** All docs are accurate and complete

## Verification Plan
- [ ] `npm install` succeeds with no errors
- [ ] `npm run build:prod` succeeds with no errors
- [ ] All new features build correctly
- [ ] CI/CD workflows are syntactically valid
- [ ] No regression in existing functionality

## Risks
- @koa/router v15 may have breaking API changes
- prettier-plugin-svelte v5 may require config changes
- Svelte 5.53 should be backward-compatible but may expose deprecation warnings
- Multi-token rotation adds complexity to server auth

## Execution Journal
_(Updated after each step)_
