# Lock the Lambda Function URL with a shared-secret origin header

Date: 2026-10-12. Status: accepted (staged rollout; enforcement is OFF until the secret is set).

## Context

The API is a Lambda Function URL with `AuthType: NONE` (`infra/template.yaml`), fronted by a CloudFront distribution that is managed out of band (not in this repo). Anyone who learns the Function URL can call it directly and bypass CloudFront, including its caching and any edge protections, and spend the shared GitHub App token's quota. The public `GET /gitlang/github/rate-limit` route also exposed that token's quota; the client defines a `RATE_LIMIT` URL constant but never calls it.

## Decision

- The Lambda requires header `x-origin-verify` to equal the `ORIGIN_VERIFY_SECRET` env var (sha256 digests compared with `crypto.timingSafeEqual`; mismatch or missing header returns 403 `{"error":"Forbidden"}`, logged as `handler_error` / `origin_verify` without the value). The check runs before token minting and routing.
- The env var comes from the SAM parameter `OriginVerifySecret` (NoEcho, default empty). **Empty means enforcement is disabled**, so merging and deploying this change alone changes nothing. CI passes it from the GitHub secret `ORIGIN_VERIFY_SECRET`.
- CloudFront adds the same value as a custom origin header `X-Origin-Verify` on the Lambda origin.
- The `/rate-limit` route is removed from the Lambda (now 404). The local-dev Koa router is unchanged.

## Rejected alternative

Origin Access Control with `AuthType: AWS_IAM` is the stronger, secret-free option (CloudFront SigV4-signs origin requests). It is not used now because flipping the Function URL to `AWS_IAM` breaks production the moment it deploys unless the distribution already has OAC attached, and the distribution is outside this repo. It remains the preferred long-term design: attach OAC to the distribution first, then switch `AuthType`, then drop the header check.

## ROLLOUT RUNBOOK

1. Merge and deploy this code with the secret unset. No-op: enforcement stays disabled.
2. Generate a random secret (for example `openssl rand -hex 32`). Add it as a custom origin header `X-Origin-Verify` on the CloudFront origin for the Lambda (path pattern `/gitlang/github/*`) and deploy the distribution. Verify traffic through gitlang.net still returns 200.
3. Set the GitHub Actions secret `ORIGIN_VERIFY_SECRET` to the same value and redeploy the API (workflow_dispatch on "Deploy API").
4. Verify: a direct Function URL call returns 403; a call via gitlang.net returns 200.

**ROLLBACK:** clear the GitHub secret and redeploy, or remove the `ORIGIN_VERIFY_SECRET` env var in the Lambda console. Enforcement is disabled immediately (the env var is read per request).

## Notes

- Rotation: repeat steps 2-3 with a new value. CloudFront could transition by adding the new value first only if the Lambda accepted both; this change accepts one value, so rotation causes a brief mismatch window (403 through CloudFront). Schedule it for low traffic, or roll back to disabled during the swap.
- Use a hex or base64url secret (no spaces, quotes or shell metacharacters) so the `sam deploy --parameter-overrides` argument parses cleanly.
- The current CI deploy user lacks CloudFormation permissions (deploys fail with AccessDenied on `CreateChangeSet`). Steps 1 and 3 need that fixed, or a manual `sam deploy` by an admin.
