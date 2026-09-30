# Wallet passes

Accepted hackers who have RSVPed can put the same check-in QR code shown on the
dashboard into Apple Wallet or Google Wallet. Environments without credentials
hide the corresponding button and omit its email merge field.

## Apple Wallet visibility

The dashboard's "Add to Apple Wallet" button stays hidden until
`APPLE_WALLET_PUBLISHED=true` is in the `environment` array in
`task-definition.json`. Until then, anyone who's RSVPed can still test the pass
by opening `/wallet/pass` directly, and `{{wallet_pass_url}}` still works in
emails.

## Google Wallet setup

1. Complete [Google Wallet issuer onboarding](https://developers.google.com/wallet/tickets/events/getting-started/issuer-onboarding), enable the Google Wallet API in the associated Google Cloud project, and note the numeric issuer ID.
2. Create a Google Cloud service account and a JSON key. In the Google Pay & Wallet console, invite the service account email with **Developer** access. Google documents the complete flow in [REST API authentication credentials](https://developers.google.com/wallet/tickets/events/getting-started/auth/rest).
3. Base64-encode the downloaded JSON so it is safe to store on one environment-variable line:

   ```bash
   base64 -i service-account.json | tr -d '\n'
   ```

4. Configure these values locally or as SecureString parameters under
   `/mhacks-secrets/` for ECS:

   | Variable                            | Value                                                                 |
   | ----------------------------------- | --------------------------------------------------------------------- |
   | `GOOGLE_WALLET_ISSUER_ID`           | Numeric issuer ID from the Wallet console                             |
   | `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY` | Base64-encoded service-account JSON                                   |
   | `WALLET_LINK_SECRET`                | At least 32 random characters; shared with emailed Apple Wallet links |

The first eligible request creates the shared `mhacks_2026` event-ticket class
and that attendee's deterministic ticket object through the REST API. Repeated
requests reuse both. The browser then receives a short, signed Save-to-Wallet
URL that references the object; the service-account key never leaves the
server.

Once the credentials are configured, the dashboard button is visible and email
campaigns can include signed Google Wallet links. The production issuer is
assumed to have publishing access, so passes are available to any Google Wallet
user and do not carry the **TEST ONLY** annotation.

## Deploying

ECS refuses to start a task when any parameter in `task-definition.json`'s
`secrets` is missing, which takes the whole dashboard down, not just Wallet.
Before merging a change that references new parameters, check they all exist:

```bash
aws ssm get-parameters --region us-east-2 --names /mhacks-secrets/APPLE_WALLET_PASS_TYPE_ID /mhacks-secrets/APPLE_WALLET_TEAM_ID /mhacks-secrets/APPLE_WALLET_SIGNER_CERT /mhacks-secrets/APPLE_WALLET_SIGNER_KEY /mhacks-secrets/APPLE_WALLET_SIGNER_KEY_PASSPHRASE /mhacks-secrets/APPLE_WALLET_WWDR_CERT /mhacks-secrets/GOOGLE_WALLET_ISSUER_ID /mhacks-secrets/GOOGLE_WALLET_SERVICE_ACCOUNT_KEY /mhacks-secrets/WALLET_LINK_SECRET --query InvalidParameters
```

It should print `[]`. SSM can't store an empty value, so if the Apple signer
key is unencrypted, set `APPLE_WALLET_SIGNER_KEY_PASSPHRASE` to any
placeholder; an unencrypted key ignores it.

## Email merge fields

Audience CSVs carry a `wallet_user_id` column, set only for RSVPed hackers.
Sending signs it into two links, valid through the end of the event:

- `{{wallet_pass_url}}` — Apple Wallet
- `{{google_wallet_pass_url}}` — Google Wallet

In a structured email, put the Google link on its own line exactly as shown:

```md
[Add to Google Wallet]({{google_wallet_pass_url}})
```

The renderer displays that link using Google's official Add to Google Wallet
badge. Its PNG is used in email for broad client support; the dashboard keeps
using the SVG version.

For ineligible recipients or unconfigured platforms, the value is blank and a
Markdown link using that field is removed by the email renderer. Previews and
test sends use sample links to the organizer's own pass.

## Static artwork

Run the asset generator after changing the ticket artwork:

```bash
node --experimental-strip-types scripts/generate-wallet-assets.ts
```

The Apple pass follows the "MHacks Check In" Pass Designer template using
`ticket-background.jpg` and `ticket-mark.png`. Google Wallet uses
`google-pass-banner.png` and `google-pass-logo.png`. Platform-specific colours
and fields are in `lib/wallet/pass.ts` and `lib/wallet/google-pass.ts`.

It produces Apple pass images in `public/wallet/pass/` and the Google Wallet
logo and hero images in `public/wallet/google/`. The official Google button SVG
is kept alongside them but is not generated.

Google downloads class artwork from its own servers at the canonical public
host. Deploy new artwork before testing it in Wallet; the next pass request
updates the shared class to use the deployed logo and banner.
