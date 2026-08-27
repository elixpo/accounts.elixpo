# CI, deployment, and npm release

`.github/workflows/deploy.yml` is the single verification and release workflow.

## Pull requests

The workflow installs dependencies, runs Biome and tests, builds the SDK, and
checks the npm package contents. It never deploys from a pull request.

## Main branch

After verification succeeds, the workflow:

1. applies pending D1 migrations to `elixpo_auth`;
2. builds and deploys Cloudflare Pages project `elixpo-accounts`;
3. publishes `packages/accounts` only when its version is not already on npm.

Prerelease versions publish under `beta`; stable versions publish under
`latest`.

The production site is deployed before the matching SDK, so published clients
never target an older server contract.

## GitHub configuration

Create these repository or environment secrets:

| Secret | Used by |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | D1 migration and Pages deployment |
| `CLOUDFLARE_ACCOUNT_ID` | Wrangler authentication |
| `NPM_TOKEN` | Publishing `@elixpo/accounts` |

Protect the `production` and `npm` environments. Runtime application secrets
remain Cloudflare Pages secrets; they are not compiled into the client bundle.
`NEXT_PUBLIC_APP_URL` is fixed to `https://accounts.elixpo.com` in CI.
