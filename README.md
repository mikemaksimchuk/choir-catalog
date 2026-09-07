# Sparta UMC Choir Music Catalog

Public choir-library catalog for Sparta United Methodist Church. The catalog is stored in `public/data.csv`, and the Vercel-hosted app provides public search, filtering, entry details, and CSV downloads.

## Administrator editing

Add and edit actions are protected by a server-side password. Successful changes update `public/data.csv` in this repository through the GitHub Contents API. Configure these production environment variables in Vercel:

- `ADMIN_PASSWORD`: the shared administrator password
- `GITHUB_TOKEN`: a fine-grained GitHub personal access token with **Contents: Read and write** access to this repository
- `GITHUB_REPOSITORY`: optional; defaults to `mikemaksimchuk/choir-catalog`
- `GITHUB_BRANCH`: optional; defaults to `main`

Never commit the real password or GitHub token. `.env.example` contains placeholders only.

## Nightly backup

The GitHub Actions workflow runs at midnight in the `America/Detroit` time zone. It copies the current catalog to `backups/latest-data.csv` and updates `public/backup-status.json`. Git history preserves every nightly version while the site header displays the most recent backup date.

The workflow can also be run manually from the repository's Actions tab.

## Local development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run normalize:data
npm run build
npm run lint
```
