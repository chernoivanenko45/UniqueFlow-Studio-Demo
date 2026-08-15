# UniqueFlow sales site — pre-launch sandbox

Separate RU/EN sales site. It does not overwrite the existing public demo.

## Safe default

`assets/sales-config.js` contains public placeholders, so all purchase buttons
stay disabled. No real payment can start in this state.

Before a Paddle sandbox test, replace only these public values:

- `paddleClientToken` — a Paddle **client-side** token (safe to expose);
- `paddleMonthlyPriceId` — the $6.99/month sandbox price ID;
- `paddleLifetimePriceId` — the $24.99 one-time sandbox price ID;
- `licenseApiBase` — the deployed Worker base URL.

Never add the Paddle webhook secret, license pepper or admin token here.

## Pages

- `/` — Russian landing page.
- `/en/` — English landing page.
- `/success/` and `/en/success/` — protected order-claim screens.

The browser generates a random claim token before checkout. Only its SHA-256
hash is sent through Paddle `custom_data`. The raw token remains in that browser
and is later exchanged for the license and a short-lived installer URL.

The monthly checkout renews automatically until canceled. Paddle lifecycle
webhooks extend or suspend the same license key; renewals do not create a new
customer key.

## Local preview

```powershell
python -m http.server 8792 --bind 127.0.0.1
```

Open `http://127.0.0.1:8792/`. The current build was checked at desktop and
375-pixel mobile widths in both languages.
