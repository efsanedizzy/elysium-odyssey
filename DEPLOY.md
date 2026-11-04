# Vercel deployment

The repository is ready to deploy after you connect your own Postgres database and configure the environment below. No credentials belong in GitHub.

## 1. Import the repository

Import `efsanedizzy/elysium-odyssey` into Vercel. Root Directory: repository root (`./`). Framework: **Other**. `vercel.json` supplies Build Command `npm run build`, Output Directory `dist`, and the API rewrite. Node.js: **24.x**. Keep the repository's configuration; do not use `npm start` as a build command.

The build publishes only `index.html`, browser source files, and project images. Server files, tests, environment files and data never enter the static output.

## 2. Connect Postgres

Create or connect a Postgres database through Vercel Marketplace (for example Neon). Use a pooled connection URL, with TLS as supplied by the provider. Add its connection string as **DATABASE_URL** in the Vercel project's Environment Variables. If the integration only adds `POSTGRES_URL`, add `DATABASE_URL` with that value. Do not paste database credentials into chat or commit them.

The database role must be allowed to create the `odyssey_state` table. The application creates it automatically on the first API request. There is no manual schema migration for a fresh deployment. Vercel requests refuse to use local JSON storage when DATABASE_URL is absent.

Use a separate database for Preview deployments, or leave database credentials disabled there. Do not share the production database with untrusted preview code.

## 3. Set the production environment

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Provider's pooled Postgres connection string |
| `APP_ORIGIN` | Exact public origin, e.g. `https://elysium-odyssey.vercel.app` (replace with your assigned domain) |
| `X_CLIENT_ID` | X Developer Portal OAuth 2.0 client ID |
| `X_CLIENT_SECRET` | X OAuth client secret, if using a confidential web client |
| `X_REDIRECT_URI` | The same public origin followed by `/api/x/callback` |
| `ELYSIUM_RPC_URL` | Optional; defaults to the configured Elysium testnet RPC |

Vercel sets NODE_ENV=production; login cookies use Secure, HttpOnly and SameSite=Lax. Never prefix secrets with public/client environment-variable prefixes. X remains disabled until its OAuth settings are supplied; wallet quests and daily/weekly rewards still work.

In the X Developer Portal configure a web app, Website URL equal to APP_ORIGIN, and Callback URL exactly equal to X_REDIRECT_URI. The app requests `tweet.read users.read`, and verifies identity through `/2/users/me`. X endpoint availability/credits are controlled by X. No following-list permission is used.

If you first deploy to obtain your domain, set the final APP_ORIGIN and callback afterwards and **Redeploy**. Visit only the final domain when connecting a wallet or X account. Changing domains also requires updating the X callback allowlist and redeploying.

## 4. Verify before announcing

1. Open the site and `/api/health`; it should return `{"ok":true,"storage":"postgres"}`.
2. Connect a wallet and sign the free login message. Verify profile XP and complete a daily check-in.
3. Refresh, disconnect and reconnect the same wallet. XP, streak and claimed rewards must remain.
4. Connect X, complete a community quest, and confirm a second attempt does not add XP.
5. Confirm the two new project images, Ecosystem page, weekly quests and profile badges load.

If health fails, check DATABASE_URL and Vercel Function logs. If X fails, check callback URL equality, app type, permissions and credits. Static deployment success alone does not verify database/OAuth configuration.

## Optional: import existing local progress

Fresh production databases start empty. Demo progress belongs only to its browser and cannot be imported as real wallet XP. To copy real local wallet progress, set DATABASE_URL in a local `.env`, back up `server/data/odyssey.json`, then run:

```sh
node --env-file=.env scripts/import-data.js server/data/odyssey.json
```

The importer refuses a nonempty destination. Wallet XP, check-in dates, completed quests, weekly claims, linked X identities and used transaction hashes are retained. Sessions and pending authentication requests are intentionally discarded; users sign in again. Never upload the JSON file to GitHub.

## Development and validation

`npm ci`, `npm run check`, `npm test`, `npm run test:postgres`, `npm run build`. Local development without DATABASE_URL still uses the JSON file and needs `npm start`. `test:postgres` uses a disposable embedded database; CI can supply TEST_DATABASE_URL pointing to a dedicated test database.

The current storage implementation locks one JSONB snapshot per request, including remote OAuth/RPC verification. This preserves atomic updates across serverless instances and suits a small community MVP. Requests serialize; before a high-traffic launch, move to normalized tables and shorter per-wallet transactions. It is not a throughput/scalability guarantee. Database backups should be enabled with your provider.
