# Enable Immediate Password-Based Editing

This setup keeps the public website on GitHub Pages. A small Cloudflare Worker receives administrator saves, validates the shared password, and commits the live CSV and backup to GitHub immediately.

The password and GitHub token must be stored as encrypted Worker secrets. Do not type either value into a file in this public repository.

## 1. Create a repository-scoped GitHub token

1. Sign in to GitHub.
2. Open **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
3. Select **Generate new token**.
4. Give it a recognizable name, such as `Choir catalog save service`.
5. Under **Repository access**, choose **Only select repositories**, then select `choir-catalog`.
6. Under **Repository permissions**, set **Contents** to **Read and write**. Leave other permissions at their defaults.
7. Generate the token and copy it. GitHub displays it only once.

The token can modify only the selected repository. The Worker code itself allows changes only to the three catalog and backup files.

## 2. Create the Cloudflare Worker

1. Sign in to the Cloudflare dashboard.
2. Open **Workers & Pages** and create a Worker named `sparta-choir-catalog-api`.
3. Open the Worker code editor.
4. Replace the sample code with the complete contents of `cloudflare-worker/index.js` from this repository.
5. Deploy the Worker.
6. Open the Worker's **Settings → Variables and Secrets** section.
7. Add these two values with the type set to **Secret**:
   - Name: `ADMIN_PASSWORD` — Value: the shared choir-catalog password
   - Name: `GITHUB_TOKEN` — Value: the fine-grained token created above
8. Deploy the secret changes.
9. Copy the Worker's public address. It will look similar to `https://sparta-choir-catalog-api.your-subdomain.workers.dev`.

Cloudflare encrypts Worker secrets and does not display their values again after they are saved.

## 3. Connect the website to the Worker

1. In this GitHub repository, open `public/config.js`.
2. Select the pencil icon to edit it.
3. Replace `PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE` with the exact Worker address from the previous section. Do not add a slash at the end.
4. The finished file should resemble:

   ```javascript
   window.CHOIR_CATALOG_CONFIG = {
     saveApiUrl: 'https://sparta-choir-catalog-api.your-subdomain.workers.dev',
   }
   ```

5. Commit the change directly to `main`.
6. Wait for **Deploy catalog to GitHub Pages** in the Actions tab to finish with a green check mark.

## 4. Test immediate editing

1. Open https://mikemaksimchuk.github.io/choir-catalog/ and refresh the page.
2. Open an entry and select **Edit Entry**.
3. Enter the shared password.
4. Make a harmless test change and select **Save Entry**.
5. The entry should reopen with the new information immediately.
6. In GitHub, open `public/data.csv` and confirm that a new commit was created.
7. Open `backups/latest-data.csv` and confirm that it contains the same updated catalog.

If the website says that online editing has not been connected, verify the Worker address in `public/config.js`. If the password is rejected, verify the `ADMIN_PASSWORD` Worker secret. If GitHub cannot save, create a fresh fine-grained token and replace the `GITHUB_TOKEN` Worker secret.

## Backup behavior

- Live database: `public/data.csv`
- Latest backup: `backups/latest-data.csv`
- Backup status shown in the header: `public/backup-status.json`
- Immediate schedule: all three files update after every successful Add or Edit operation
- Safety schedule: `.github/workflows/nightly-backup.yml` refreshes the backup at approximately 12:05 a.m. Detroit time every night
- Historical backups: GitHub commit history retains earlier versions of the CSV
