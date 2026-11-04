# Elysium Odyssey ⚔ — Quest-to-Earn MVP

**A working English-language Web3 quest platform for Kinetiq Elysium Testnet**, developed as an independent community MVP. No cryptocurrency is issued or distributed by this project. No external npm packages or build steps are required.

## Quick start

**Requirement:** Node.js 20 or newer.

```bash
# Open the downloaded project folder in your terminal:
cd elysium-odyssey
npm start
```

Open **http://localhost:3000** in your browser. The address is only available on your own machine unless you deploy the project.

For auto-reloading the API while editing:

```bash
npm run dev
```

You can also run `node server/index.js`. There is **no `npm install` step** — this app uses only Node.js built-in modules and standard browser APIs.

### What's inside?

| Feature | Implementation |
| --- | --- |
| Wallet login | MetaMask/Rabby (injected EVM wallets), challenge + `personal_sign`, server verifies secp256k1 recovery |
| Network | Kinetiq Elysium Testnet, Chain ID **99801**, HYPE gas |
| Quests | Welcome, educational quiz, self-attested explorer visit, once-per-UTC-day check-in, verified testnet transaction |
| XP and levels | Server calculates scores and level from XP, limits repeated one-time claims |
| Leaderboard | Real authenticated wallet accounts only; no seeded fake accounts |
| Demo mode | Interactive local browser sandbox, never shown in public ranking |
| Storage | `server/data/odyssey.json`, atomically written on changes (created on first use) |
| UI | Responsive, English, dark fantasy control room, no external assets or fonts required |

## Elysium testnet

**Use these exact settings — not the unrelated Vulcan Forged Elysium (1338).**

- Name: Kinetiq Elysium Testnet
- Chain ID: `99801` (`0x185d9`)
- RPC: `https://testnet-rpc.elysium.kinetiq.xyz`
- Gas currency: `HYPE`
- Explorer: `https://testnet.elysium.kinetiq.xyz`

Wallet sign-in, daily XP and X quests work without changing networks. Use the network button to add or switch to Elysium Testnet when needed for onchain activity. It asks for a *free signature* for authentication, never a token transfer or spending approval.

Official docs: https://elysium.kinetiq.xyz/docs/building-on-elysium

## How to use

1. Click **Connect wallet** and approve the **login signature** in your wallet, or choose **Try interactive demo** without connecting a wallet.
2. Enter **Quest board**, select a quest and complete its objectives.
3. For **Know Your Realm**, answer all three questions; the real answer key lives only in the Node server.
4. **Daily Ritual** may be completed once per UTC day.
5. **Chart the Unknown** asks for an explicit confirmation and is **self-attested**, not cryptographically verified.
6. **Footprints Onchain** uses an Elysium Testnet transaction hash and the RPC, validates the chain ID, success receipt, sender equals the authenticated wallet and timestamp after account registration; **testnet HYPE gas may be required**. This is optional, and you do not send assets to Odyssey.
7. XP is an **offchain score**; it is not an airdrop guarantee or a cryptocurrency.

## Development files

```text
elysium-odyssey/
├── index.html                 # Main app page
├── src/
│   ├── main.js               # Interactive UI and browser wallet support
│   ├── styles.css            # Desktop/mobile design
│   └── constants.js          # Quest labels + public network settings
├── server/
│   ├── index.js              # Native Node HTTP API + persistent DB
│   ├── crypto.js             # Pure JS Keccak + secp256k1 login verification
│   └── data/                 # Created on first use; keep private
├── public/favicon.svg
├── package.json
└── README.md
```

API routes:

- `GET /api/config`, `/api/me`, `/api/quests`, `/api/leaderboard`, `/api/quiz`
- `POST /api/auth/challenge`, `/api/auth/verify`, `/api/auth/logout`
- `POST /api/quests/:id/claim`
- `POST /api/quests/transaction/verify`

No private keys, transaction signing keys or token contracts are stored server-side.

## Deploying

Deploy to a server with Node.js 20+ and a **persistent filesystem/volume**. Start with `npm start`. Terminate HTTPS at a reverse proxy (e.g. Nginx, Caddy or your hosting platform) and set `NODE_ENV=production` so login cookies are `Secure`.

The server port defaults to `3000`. Set `PORT` to customize it, and optionally `ELYSIUM_RPC_URL` to point to your own Elysium RPC provider. Example:

```bash
PORT=8080 NODE_ENV=production npm start
```

**Do not upload `server/data/` or publish its contents.** This file contains session state and user scores. It is excluded in `.gitignore`.

### Security / production-readiness notes

This is a **functional testnet MVP**, not a security-audited mainnet product. Before using it at scale or offering economic rewards:

- Replace JSON-file storage with PostgreSQL/another transactional database, unique constraints and atomic reward operations; the MVP is intended for **one** Node server instance and a small community.
- Add strong anti-bot and Sybil defenses, particularly for self-attested and daily quests; a wallet signature does not prove a unique person.
- Use a domain-bound SIWE/EIP-4361 message, formal threat modeling, stronger application metrics and a professional audit before handling assets or valuable rewards.
- Use a managed/validated RPC, logging, backups, secrets management, alerting, anti-DDoS and a production TLS configuration.
- The optional explorer-visit quest is explicitly **self-attested**. Quiz answers can be guessed. Neither should be used for economically valuable rewards without further safeguards.
- Testnet availability and RPC status are managed by external providers. If RPC lookups are unavailable, only the onchain quest is affected.
- A token contract, payment system, public hosting, automated airdrop allocation **is not part of this MVP**.

## Branding and independence

This is a community-designed concept for Elysium; it is not endorsed by or officially associated with Kinetiq or Elysium. Use official brand assets and integrations only when allowed by their owners.


## Daily streaks and X-linked visit rewards

Daily Ritual awards 45 XP per UTC day plus 100 bonus XP every seventh consecutive
check-in. Missing a day resets the current streak, while the best streak is retained.

The X quest requires both a wallet login and an X account connected through OAuth
2.0 PKCE. A verified X user ID is permanently bound to one wallet; another wallet
cannot reuse it. Users then click **Visit X & claim +100 XP** for one reward.
Following is not checked. The server never requests following lists or profile
lookup by username. It uses only OAuth token exchange and `GET /2/users/me` to
identify the account. X identity/API availability and billing still apply; this
is not a guarantee of permanently free X authentication.

Set `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REDIRECT_URI` in `.env`. Use callback
`http://127.0.0.1:3000/api/x/callback` locally and open the site on the same host.
The app requests only `tweet.read users.read`, with no following permissions.
The linked ID and username survive logout and restart. No access token is persisted.
Existing earned points remain unchanged; completed quests cannot reward twice.
Demo accounts cannot claim the X reward. Tests reject any unexpected X API endpoint
and check unlinked claims, duplicate X linking and concurrent repeat rewards.

## Ecosystem follow quests

Eight additional X quests award 100 XP each with mandatory X linking and no
follow-list verification. Each quest has its own permanent completion ID.
Images are snapshots downloaded from each supplied public X profile and served
locally from `public/social-*`; no avatar API runs when visitors load the page.
Profiles: @ElysIndex, @agora_elysium, @Stockium, @homer_fi, @ElysiumPump, @TheKleos_, @ManteionH, @boxa_elysium.
