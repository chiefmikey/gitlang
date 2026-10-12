# Lock the Lambda Function URL with a shared-secret origin header

Date: 2026-10-12. Status: accepted (staged rollout; enforcement is OFF until the secret is set).

## Context

The API is a Lambda Function URL with `AuthType: NONE` (`infra/template.yaml`), fronted by a CloudFront distribution that is managed out of band (not in this repo). Anyone who learns the Function URL can call it directly and bypass CloudFront, including its caching and any edge protections, and spend the shared GitHub App token's quota. The public `GET /gitlang/github/rate-limit` route also exposed that token's quota; the client defines a `RATE_LIMIT` URL constant but never calls it.

## Decision

- The Lambda requires header `x-origin-verify` to equal the `ORIGIN_VERIFY_SECRET` env var (sha256 digests compared with `crypto.timingSafeEqual`; mismatch or missing header returns 403 `{"error":"Forbidden"}`, logged as `handler_error` / `origin_verify` without the value). The check runs before token minting and routing.
- The env var comes from the SAM parameter `OriginVerifySecret` (NoEcho, default empty). **Empty means enforcement is disabled**, so merging and deploying this change alone changes nothing. API deploys are manual (the CI user cannot deploy the stack), so the value is set with `--parameter-overrides` on a manual `sam deploy`. A later deploy that omits the parameter keeps the stack's previous value (SAM sends `UsePreviousValue`), so routine deploys need not know the secret.
- CloudFront adds the same value as a custom origin header `X-Origin-Verify` on the Lambda origin.
- The `/rate-limit` route is removed from the Lambda (now 404). The local-dev Koa router is unchanged.

## Rejected alternative

Origin Access Control with `AuthType: AWS_IAM` is the stronger, secret-free option (CloudFront SigV4-signs origin requests). It is not used now because flipping the Function URL to `AWS_IAM` breaks production the moment it deploys unless the distribution already has OAC attached, and the distribution is outside this repo. It remains the preferred long-term design: attach OAC to the distribution first, then switch `AuthType`, then drop the header check.

## ROLLOUT RUNBOOK

All AWS steps use an admin profile (stack `gitlang-api` in us-east-2; the gitlang.net CloudFront distribution, origin id `gitlang-lambda-api`).

1. Deploy this code with no `OriginVerifySecret` override. No-op: enforcement stays disabled; `/rate-limit` returns 404.
2. Generate a random secret (`openssl rand -hex 32`). Add it as custom origin header `X-Origin-Verify` on origin `gitlang-lambda-api` and wait for the distribution to deploy. The Lambda ignores the header while enforcement is off. Verify gitlang.net API calls still return 200.
3. `sam deploy --template-file infra/template.yaml --stack-name gitlang-api --capabilities CAPABILITY_IAM --resolve-s3 --region us-east-2 --parameter-overrides OriginVerifySecret=<secret>`.
4. Verify: a direct Function URL call returns 403; a call via gitlang.net returns 200.

**ROLLBACK:** for an immediate fix, remove the `ORIGIN_VERIFY_SECRET` env var from the function configuration (read per request, takes effect at once). Then make it durable with a deploy that passes `--parameter-overrides OriginVerifySecret=""`. Omitting the parameter does NOT disable enforcement; it keeps the previous value.

## Notes

- Rotation: repeat steps 2-3 with a new value. CloudFront could transition by adding the new value first only if the Lambda accepted both; this change accepts one value, so rotation causes a brief mismatch window (403 through CloudFront). Schedule it for low traffic, or roll back to disabled during the swap.
- Use a hex or base64url secret (no spaces, quotes or shell metacharacters) so the `sam deploy --parameter-overrides` argument parses cleanly.
- The CI deploy user lacks CloudFormation permissions by design, so the Deploy API workflow is manual-only and API deploys run from an admin profile.
- The secret lives only in the CloudFront origin config and the stack parameter (NoEcho). To recover it, read the origin's custom header from the distribution config.
