# Sparta UMC Choir Music Catalog

Accessible, searchable choir-library catalog for Sparta United Methodist Church. The site is hosted entirely by GitHub Pages at:

https://mikemaksimchuk.github.io/choir-catalog/

The catalog itself is `public/data.csv`. It can be downloaded from the site at any time.

For the original GitHub Pages setup, see [`INSTALL_GITHUB_PAGES.md`](INSTALL_GITHUB_PAGES.md). To enable immediate password-based editing, follow [`INSTALL_IMMEDIATE_EDITING.md`](INSTALL_IMMEDIATE_EDITING.md).

## How editing works

The shared catalog password unlocks the Add and Edit forms for the current browser tab. A small Cloudflare Worker checks that password and writes the requested change to GitHub:

1. Complete an Add or Edit form on the site.
2. Select **Save Entry**.
3. The Worker updates `public/data.csv`, `backups/latest-data.csv`, and `public/backup-status.json` together in one GitHub commit.
4. The editor sees the saved entry immediately. Other visitors see it when they load or refresh the catalog.

The plaintext password and repository-scoped GitHub token are stored only as encrypted Cloudflare Worker secrets. They are not committed to this public repository or sent to ordinary catalog visitors.

## One-time GitHub setup

1. Open **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
2. Open **Settings → Actions → General**. Under **Workflow permissions**, select **Read and write permissions**, then save.
3. Open **Actions → Deploy catalog to GitHub Pages → Run workflow** to publish immediately.

The initial deployment and every later push to `main` are handled by `.github/workflows/deploy-pages.yml`.

## Nightly update and backup

Every successful administrator save immediately copies the current catalog to `backups/latest-data.csv` and updates `public/backup-status.json`. `.github/workflows/nightly-backup.yml` refreshes that same backup again at approximately 12:05 a.m. Detroit time. Git history preserves every committed version.

The workflow runs at both possible UTC offsets and exits unless the local Detroit hour is midnight. It can also be run immediately from the Actions tab with **Run workflow**.

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
