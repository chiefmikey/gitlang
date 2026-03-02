# Retro: Modernize GitLang for 2026

_Date: 2026-03-01_

## What Was Done

Comprehensive modernization of GitLang v5.0.0:
- Resolved all merge conflicts and cleaned dependencies
- Updated all dependencies to latest compatible versions
- Resolved all 14 open GitHub issues (8 features, 6 bugs)
- Added AWS Lambda token rotation infrastructure
- Removed SonarCloud entirely
- Updated documentation and project context

## What Worked Well

- **Subagent parallelism**: Closing 14 issues simultaneously via background agent saved significant time
- **Incremental commits**: One commit per feature kept changes atomic and reviewable
- **Extension map approach for contributor filtering**: Using file extension → language mapping from commits is lightweight and doesn't require additional API calls beyond what Octokit provides
- **Compare mode architecture**: Splitting by `~` and processing groups independently kept the code clean

## What Could Be Better

- **Pre-existing TypeScript errors**: `languages.ts` has a type casting issue that predates this work. Should be fixed in a separate PR.
- **Webpack dev dependencies**: 29 npm audit vulnerabilities all trace back to webpack 5 and its loaders. Can't fix until webpack 6 releases. Documented as safe to ignore (dev-only).
- **ESLint + TypeScript**: Using `@babel/eslint-parser` with TypeScript files requires disabling `no-undef` for `.ts` files. Consider migrating to `@typescript-eslint/parser` in a future cleanup.

## Key Decisions

1. **Used `~` instead of `?` in URLs for compare mode** — `?` conflicts with query strings, `~` is URL-safe
2. **`@author` syntax after repo name** — `user/repo@author` is intuitive (like git email/ref syntax) and doesn't conflict with `@user` prefix
3. **50 commit limit for contributor analysis** — balances coverage vs API rate limit consumption
4. **Notification-based Lambda rotation** — GitHub PATs can't be auto-created via API, so the Lambda notifies via SNS when manual rotation is needed

## Follow-Up Items

- Consider migrating ESLint config to `@typescript-eslint/parser`
- Monitor webpack 6 release for security vulnerability resolution
- Consider adding e2e tests with Playwright for the new features
- The contributor filtering makes many API calls (one per commit) — consider server-side caching if this becomes a rate limit issue
