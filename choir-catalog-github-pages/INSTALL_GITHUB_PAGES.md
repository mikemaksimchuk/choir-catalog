# Install the Choir Catalog on GitHub Pages

These instructions replace the Vercel deployment. No Vercel account, environment variables, personal access token, or paid hosting is required.

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
   - `scripts/apply-change-requests.mjs`
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
6. Open the repository's **Settings → General** page.
7. Under **Features**, make sure **Issues** is checked.

## Part 3 — Publish it now

1. Open https://github.com/mikemaksimchuk/choir-catalog/actions.
2. In the left column, select **Deploy catalog to GitHub Pages**.
3. Select **Run workflow**, leave `main` selected, and select the green **Run workflow** button.
4. Wait for the workflow to show a green check mark.
5. Open https://mikemaksimchuk.github.io/choir-catalog/.

GitHub also republishes the site automatically after future commits to `main`.

## Part 4 — Test an edit

1. Open the GitHub Pages website and select any catalog entry.
2. Select **Edit Entry**.
3. Enter the catalog password supplied separately.
4. Make a harmless test change and select **Continue on GitHub**.
5. GitHub opens a prepared issue. Sign in, review it, and select **Submit new issue**.
6. To apply it immediately instead of waiting until midnight, open **Actions → Apply catalog changes and back up nightly → Run workflow**.
7. Wait for a green check mark, then refresh the catalog website.

Only a request authored by the repository owner or a repository collaborator is applied. Other requests are rejected and closed automatically.

## Part 5 — Retire Vercel

After the GitHub Pages address works:

1. Remove any old bookmark or church website link pointing to `choir-catalog.vercel.app` and replace it with `https://mikemaksimchuk.github.io/choir-catalog/`.
2. In Vercel, open the old `choir-catalog` project.
3. Open **Settings → Advanced → Delete Project** only if you no longer want the old Vercel address to remain online.

Deleting the Vercel project is optional and does not affect the GitHub Pages site.

## How the password and GitHub sign-in work

The shared password unlocks the Add and Edit screens in the current browser tab. It is stored in the website only as a SHA-256 hash, not as readable text. However, every file sent by a static GitHub Pages site is public, so a determined person can inspect or bypass that browser check.

GitHub sign-in is therefore the real security boundary. The nightly workflow checks GitHub's author relationship and only writes to the database for the repository owner, a member, or a collaborator. The built-in workflow token stays inside GitHub Actions and is never sent to a website visitor.
