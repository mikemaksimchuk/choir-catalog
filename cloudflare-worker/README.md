# Choir Catalog Save Worker

This Cloudflare Worker lets the GitHub Pages website validate the shared administrator password and save catalog changes immediately. The password and GitHub token must be added as encrypted Worker secrets; never paste either value into `index.js`, `wrangler.jsonc`, or the public website files.

See `../INSTALL_IMMEDIATE_EDITING.md` for the complete dashboard setup.
