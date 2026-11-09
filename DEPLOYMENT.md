# Angel Companion deployment

## GitHub Actions pipeline

- Pull requests targeting `main`: install, type-check, run tests, and build. No production database or site changes.
- Pushes to `main` and manual workflow dispatch: validate, apply pending Supabase migrations, then build and publish the production Netlify site.
- Production migrations and deploys are serialized to prevent overlapping releases.

## Required GitHub Actions repository secrets

Add these under **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token with permission to manage the project |
| `SUPABASE_DB_PASSWORD` | Database password for the Angel Supabase project |
| `SUPABASE_PROJECT_REF` | `qltiogotxbxwzwmnypwu` |
| `NETLIFY_AUTH_TOKEN` | Netlify personal access token |
| `NETLIFY_SITE_ID` | `4d470484-81c4-443e-8a3a-d77f7df93b36` |

Never put these credentials in source files, commit messages, or frontend environment variables.

## Migration history reconciliation

The original foundation migration is named to match the migration already recorded in the production Supabase history. The conversation client-ID migration was applied directly before migration automation was configured; the workflow marks that exact version as applied if it is not already recorded, then pushes any remaining migrations. It does not re-run that DDL.

## Release safety

Only `main` can apply production migrations or publish the production site. Feature branches and pull requests run validation only. Review and merge a pull request to release.
