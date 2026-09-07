# Sparta UMC Choir Music Catalog

Accessible, searchable choir-library catalog for Sparta United Methodist Church. The site is hosted entirely by GitHub Pages at:

https://mikemaksimchuk.github.io/choir-catalog/

The catalog itself is `public/data.csv`. It can be downloaded from the site at any time.

For click-by-click setup instructions, see [`INSTALL_GITHUB_PAGES.md`](INSTALL_GITHUB_PAGES.md).

## How editing works

The shared catalog password unlocks the Add and Edit forms for the current browser tab. Because GitHub Pages is a static public host, that password is an interface deterrent—not a secure authorization boundary. A determined visitor can inspect or bypass browser code.

Actual write authorization is handled by GitHub:

1. Complete an Add or Edit form on the site.
2. Select **Continue on GitHub**.
3. Sign in to GitHub, review the prepared request, and select **Submit new issue**.
4. At midnight in the `America/Detroit` time zone, GitHub Actions applies requests only when GitHub identifies the author as this repository's owner, member, or collaborator.
5. The workflow updates `public/data.csv`, creates the backup, republishes GitHub Pages, comments on the request, and closes it.

No GitHub token or plaintext password is stored in the public site. GitHub supplies a short-lived Actions token to the nightly workflow.

## One-time GitHub setup

1. Open repository **Settings → General → Features** and make sure **Issues** is enabled.
2. Open **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Settings → Actions → General**. Under **Workflow permissions**, select **Read and write permissions**, then save.
4. Open **Actions → Deploy catalog to GitHub Pages → Run workflow** to publish immediately.

The initial deployment and every later push to `main` are handled by `.github/workflows/deploy-pages.yml`.

## Nightly update and backup

`.github/workflows/nightly-backup.yml` checks for authorized catalog change requests at midnight Detroit time, updates the CSV, copies it to `backups/latest-data.csv`, updates `public/backup-status.json`, and publishes the result. Git history preserves earlier versions.

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
