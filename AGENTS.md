# Agent Guidelines & Project Metadata

This document tracks specialized instructions and constraints for AI agents working on the Elixpo Accounts codebase.

## D1 Migrations

- **Idempotency**: D1 tracks applied migrations by their full filename. Never rename or modify a migration file that has already been applied to production.
- **Ordering**: Migrations are applied in alphabetical order. We use a 4-digit prefix (e.g., `0001_`, `0002_`) to enforce chronological order.
- **Duplicate Check**: A CI safeguard in `.github/workflows/deploy.yml` checks for duplicate 4-digit prefixes to enforce strict chronological D1 migration ordering. If duplicates are found, the build will fail.
- **Naming Convention**: `XXXX_descriptive_name.sql`
- **Known Issues**: `0002_add_col_privilage.sql` contains a typo ("privilage" instead of "privilege"). **Do NOT rename this file**, as it has already been applied and renaming it would break the D1 idempotency ledger.

## CI/CD

- **GitHub Actions**: Deployment is handled via `.github/workflows/deploy.yml`.
- **Pre-deployment Checks**:
    - `npm ci`
    - Duplicate migration prefix check
    - Cloudflare Pages build (`next-on-pages`)
