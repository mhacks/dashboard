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
`ses:SendEmail`; the setup command additionally needs `ses:GetContactList`,
`ses:CreateContactList`, and `ses:UpdateContactList`.

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
