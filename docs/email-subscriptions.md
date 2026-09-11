# Email subscriptions

MHacks stores optional-email preferences in Postgres. Amazon SES delivers the
message, but it is not the source of truth and no SES contact list is required.

## Configuration

Set these variables in every deployed environment:

```bash
EMAIL_UNSUBSCRIBE_SECRET=<a-long-random-secret>
```

`EMAIL_UNSUBSCRIBE_SECRET` signs links, must contain at least 32 characters in
production, and must not be exposed to the browser. Rotating it invalidates
links in previously sent email, so rotate only when necessary. Production
unsubscribe links always use `https://mhacks.org`.

Development falls back to `http://localhost:3000` and a local-only signing
secret so Mailpit sends work without extra setup.

## Message types

- **Optional update** is for newsletters and promotional announcements. Before
  each send, the app reads `email_preferences` for the normalized recipient
  address and the `event-updates` topic. Unsubscribed recipients are suppressed
  without calling SES.
- **Required operational email** is for application decisions, RSVP actions,
  travel details, and account notices. It intentionally bypasses optional-email
  preferences and does not include list-unsubscribe headers.

The test send is tied to the selected message type. Changing the type requires
a new successful test before a full-list send. An unsubscribed test recipient
prevents the test proof from being issued.

## Preference records

`email_preferences` is keyed by case-normalized email address and topic. Its
`user_id` is nullable because admin campaigns can include CSV or manually typed
addresses that do not have MHacks accounts. If a matching account exists, the
preference is linked to it automatically.

An address without a row is subscribed by default. The first optional send or
visit to the account preference page creates the row. Full-list campaign runs
count an opt-out as **suppressed**, separately from sent and failed deliveries.

## Unsubscribe paths

Each optional email gets two signed MHacks URLs based on the preference's random
UUID:

- The visible footer opens `/email/unsubscribe`, which displays a confirmation
  before changing anything. A GET never unsubscribes, preventing mail security
  scanners from mutating preferences simply by checking a link.
- The `List-Unsubscribe` header points to `/api/email/unsubscribe`. Email clients
  POST `List-Unsubscribe=One-Click` there for RFC 8058 one-click unsubscribe.

The signature prevents a recipient from changing another preference by guessing
an ID. The URL does not expose an email address or user ID. Both unsubscribe
operations are idempotent.

Signed-in users can subscribe or unsubscribe at
`/account/email-preferences`. This account page and the email links update the
same database row.

## SES and events

SES receives custom `List-ID`, `List-Unsubscribe`, and
`List-Unsubscribe-Post` headers in the raw message. The sender needs only its
normal SES send permission; it does not need contact-list read/write access.
RFC 8058 also requires the two unsubscribe headers to be covered by a valid
DKIM signature. Keep Easy DKIM enabled for the SES sending identity and verify
the headers in a real delivered message after deployment.

SES configuration-set events remain useful for deliveries, bounces, and
complaints. They are separate from this preference system: SES will not emit a
managed `Subscription` event because MHacks, not an SES contact list, processes
the unsubscribe.
