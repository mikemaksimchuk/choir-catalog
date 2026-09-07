# Install the Choir Catalog on GitHub Pages

These instructions replace the Vercel deployment and publish the public catalog on GitHub Pages. After the site is online, follow `INSTALL_IMMEDIATE_EDITING.md` to connect immediate password-based editing.

## Part 1 — Upload the replacement files

1. Download and unzip `choir-catalog-github-pages.zip` from ChatGPT.
2. Open https://github.com/mikemaksimchuk/choir-catalog and sign in.
3. On the **Code** tab, select **Add file → Upload files**.
4. Drag the **contents inside** the unzipped `choir-catalog-github-pages` folder into the upload area. Do not drag the outer folder itself.
5. Confirm that the upload list includes these easily missed files and folders:
   - `.github/workflows/deploy-pages.yml`
   - `.github/workflows/nightly-backup.yml`
   - `package-lock.json`
   - `vite.config.js`
   - `public/config.js`
   - `cloudflare-worker/index.js`
6. Under **Commit changes**, enter `Move choir catalog to GitHub Pages`.
7. Select **Commit directly to the main branch**, then select **Commit changes**.

The following old Vercel-only files are not used by GitHub Pages. If they remain in the repository after the upload, they are harmless, but they can be deleted later:

- `.env.example`
- `vercel.json`
- `api/auth.js`
- `api/catalog.js`
- `server/githubCatalog.js`
- `server/session.js`
- `public/vite.svg`
- `src/App.css`
- `src/assets/react.svg`

## Part 2 — Turn on GitHub Pages

1. Open https://github.com/mikemaksimchuk/choir-catalog/settings/pages.
2. Under **Build and deployment**, change **Source** to **GitHub Actions**.
3. Open https://github.com/mikemaksimchuk/choir-catalog/settings/actions.
4. Scroll to **Workflow permissions**.
5. Select **Read and write permissions**, then select **Save**.

## Part 3 — Publish it now

1. Open https://github.com/mikemaksimchuk/choir-catalog/actions.
2. In the left column, select **Deploy catalog to GitHub Pages**.
3. Select **Run workflow**, leave `main` selected, and select the green **Run workflow** button.
4. Wait for the workflow to show a green check mark.
5. Open https://mikemaksimchuk.github.io/choir-catalog/.

GitHub also republishes the site automatically after future commits to `main`.

## Part 4 — Enable and test immediate editing

Follow every step in `INSTALL_IMMEDIATE_EDITING.md`. That guide creates the small save service, stores the shared password and repository token privately, connects the public website, and walks through a test edit.

## Part 5 — Retire Vercel

After the GitHub Pages address works:

1. Remove any old bookmark or church website link pointing to `choir-catalog.vercel.app` and replace it with `https://mikemaksimchuk.github.io/choir-catalog/`.
2. In Vercel, open the old `choir-catalog` project.
3. Open **Settings → Advanced → Delete Project** only if you no longer want the old Vercel address to remain online.

Deleting the Vercel project is optional and does not affect the GitHub Pages site.

## How password-based editing works

The shared password unlocks the Add and Edit screens and authorizes each save through a Cloudflare Worker. The plaintext password and repository-scoped GitHub token are stored as encrypted Worker secrets, never in the public website files. A successful save updates the live CSV and its backup immediately; a nightly GitHub Action provides an additional automatic backup refresh.
