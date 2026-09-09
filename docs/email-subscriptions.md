# Email subscriptions

Admin campaign sends default to **Optional update**. These sends use Amazon SES
subscription management with the contact list `mhacks` and topic
`event-updates`. SES adds RFC 8058 one-click unsubscribe headers, replaces the
managed unsubscribe URL in the visible footer, and prevents future sends to
contacts who opt out of that topic.

## Provision SES

The contact list and topic must exist in the same AWS account and region used
for sending. With AWS credentials in the environment, run:

```bash
pnpm email:setup
```

The setup is idempotent. Override the defaults with `SES_REGION`,
`SES_CONTACT_LIST`, and `SES_CONTACT_TOPIC`. The sending identity needs
`ses:SendEmail` and `ses:ListContacts`; the setup command additionally needs
`ses:GetContactList`, `ses:CreateContactList`, and `ses:UpdateContactList`.

Run setup with a separate provisioning or administrator identity. Do not add
contact-list management permissions to the production sender merely to run the
one-time setup.

## Message types

- **Optional update** is for newsletters and promotional announcements. It
  includes the unsubscribe footer and SES list-management options.
- **Required operational email** is for application decisions, RSVP actions,
  travel details, and account notices. It intentionally omits subscription
  management so an optional-email opt-out does not hide required information.

The test send is tied to the selected message type. Changing the type requires
a new successful test before a full-list send.

## Opt-outs during a send

SES creates a contact automatically the first time an optional update is sent to
an address, and the `event-updates` topic defaults to `OPT_IN`, so a recipient
who has never touched their preferences still receives the email. Once someone
unsubscribes, SES refuses that address for the topic and raises a bounce event
instead of delivering.

To avoid generating those bounces, every optional-update path reads the topic's
opted-out contacts with `ses:ListContacts` and skips them before calling SES.
Each path reports the skip as a failure rather than a send, because the message
was not delivered and counting it as sent would overstate the campaign:

- A **full-list send** records the skip against the run, so it counts toward the
  run's failures and appears in its recent-failure list.
- A **single send** returns a failure naming the address, so the organizer knows
  the one-off never went out.
- A **test send** fails, which withholds the test-send token and therefore
  blocks the full-list send. An opted-out test recipient would otherwise let the
  test report success while nobody actually received the email — and that
  success is what unlocks sending to the whole list.

The pre-filter is best-effort and cached for a minute. If the lookup fails, is
denied, or misses a recent unsubscribe, the send proceeds unfiltered and SES
still enforces the opt-out, so the cost of a miss is a bounce rather than an
unwanted delivery.
