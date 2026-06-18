# Application Form

Route: `/apply/hacker`  
Entry point: `app/apply/hacker/page.tsx` → `app/apply/hacker/application-form.tsx`

## Overview

The hacker application is a 6-step multi-page form built with React Hook Form + Zod. It auto-saves progress to `localStorage` on every field change, restores that draft on mount, and submits via a Next.js server action that inserts a row into `hacker_applicants`.

---

## File Structure

```
app/apply/hacker/
├── page.tsx                        # Server component — resolves auth, passes userId promise
├── application-form.tsx            # Main form shell (steps, navigation, submission)
└── components/
    ├── personal-information.tsx    # Step 0
    ├── academic-information.tsx    # Step 1 (includes resume upload)
    ├── essays.tsx                  # Step 2
    ├── logistics.tsx               # Step 3
    ├── socials.tsx                 # Step 4
    ├── communications.tsx          # Step 4 (rendered alongside Socials)
    └── agreements.tsx              # Step 5

lib/
├── types/applications.ts                           # Zod schema + TypeScript types
└── actions/application-form.server.actions.ts      # submitHackerApplication server action
```

---

## Steps

| Index | Label                    | Validated fields                                                                   |
| ----- | ------------------------ | ---------------------------------------------------------------------------------- |
| 0     | Personal                 | `age`, `gender`, `ethnicity`                                                       |
| 1     | Academic                 | `university`, `country`, `degree`, `graduationYear`, `previousHackathons`, `major` |
| 2     | Essays                   | `whyAttend`, `technicalChallenge`, `proudProject`                                  |
| 3     | Logistics                | `transportationType`, `comingFrom`, `shirtSize`                                    |
| 4     | Socials + Communications | _(none — optional fields only)_                                                    |
| 5     | Agreements               | `mlhCodeOfConduct`, `mlhPrivacyPolicy`, `mlhEmails`                                |

Validation for each step is scoped: clicking **Continue** calls `trigger(stepFields)` and only advances if those fields are valid. Steps with an empty `fields` array (Socials/Communications) advance unconditionally.

---

## All Form Fields

### Personal (step 0)

| Field            | Type   | Required | Constraint                                 |
| ---------------- | ------ | -------- | ------------------------------------------ |
| `age`            | number | yes      | ≥ 18                                       |
| `gender`         | string | yes      | non-empty                                  |
| `genderOther`    | string | no       | free text (shown when gender = "Other")    |
| `ethnicity`      | string | yes      | non-empty                                  |
| `ethnicityOther` | string | no       | free text (shown when ethnicity = "Other") |

### Academic (step 1)

| Field                | Type   | Required | Constraint                                  |
| -------------------- | ------ | -------- | ------------------------------------------- |
| `university`         | string | yes      | non-empty                                   |
| `universityOther`    | string | no       | free text (shown when university = "Other") |
| `country`            | string | yes      | non-empty                                   |
| `countryOther`       | string | no       | free text (shown when country = "Other")    |
| `degree`             | string | yes      | non-empty                                   |
| `degreeOther`        | string | no       | free text (shown when degree = "Other")     |
| `graduationYear`     | number | yes      | ≥ 2026                                      |
| `previousHackathons` | number | yes      | ≥ 0                                         |
| `major`              | string | yes      | non-empty                                   |
| `majorOther`         | string | no       | free text (shown when major = "Other")      |
| `resume`             | string | no       | S3 key — uploaded via presigned PUT URL     |

### Essays (step 2)

| Field                | Type   | Required | Constraint          |
| -------------------- | ------ | -------- | ------------------- |
| `whyAttend`          | string | yes      | 100–1000 characters |
| `technicalChallenge` | string | yes      | 100–1000 characters |
| `proudProject`       | string | yes      | 100–1000 characters |
| `anythingElse`       | string | no       | 0–1000 characters   |

### Logistics (step 3)

| Field                             | Type    | Required | Constraint                                                  |
| --------------------------------- | ------- | -------- | ----------------------------------------------------------- |
| `transportationType`              | string  | yes      | non-empty (e.g. "flying", "driving")                        |
| `comingFrom`                      | string  | yes      | non-empty city/location                                     |
| `airportCode`                     | string  | no       | 3-letter IATA code (e.g. `DTW`) — only relevant when flying |
| `shirtSize`                       | string  | yes      | non-empty (e.g. "m", "l", "xl")                             |
| `hasAllergies`                    | boolean | yes      | default `false`                                             |
| `allergiesDescription`            | string  | no       | ≤ 500 chars (shown when hasAllergies = true)                |
| `needsTravelReimbursement`        | boolean | yes      | default `false`                                             |
| `wouldAttendWithoutReimbursement` | boolean | no       | shown when needsTravelReimbursement = true                  |

### Socials (step 4)

| Field          | Type   | Required | Constraint         |
| -------------- | ------ | -------- | ------------------ |
| `github`       | string | no       | valid URL or empty |
| `linkedin`     | string | no       | valid URL or empty |
| `personalSite` | string | no       | valid URL or empty |

### Communications (step 4, rendered below Socials)

| Field              | Type    | Required | Constraint                                               |
| ------------------ | ------- | -------- | -------------------------------------------------------- |
| `followsInstagram` | boolean | no       | checkbox — "Did you follow us on Instagram (@mhacks\_)?" |

### Agreements (step 5)

| Field              | Type    | Required | Constraint                     |
| ------------------ | ------- | -------- | ------------------------------ |
| `mlhCodeOfConduct` | boolean | yes      | must be `true`                 |
| `mlhPrivacyPolicy` | boolean | yes      | must be `true`                 |
| `mlhEmails`        | boolean | yes      | must be `true`                 |
| `sponsorEmails`    | boolean | no       | optional sponsor email consent |

---

## Draft Auto-Save

The form persists all field values to `localStorage` under the key `mhacks-application-draft` on every field change via a `watch` subscription. On mount, the saved draft is restored with `setValue` for any field that has a non-null, non-empty value. The draft is cleared from `localStorage` on successful submission.

---

## Resume Upload

Handled inside `AcademicInformation` (step 1). Flow:

1. User selects a PDF file.
2. Component calls `getResumeUploadUrl(userId, fileName)` — a server action that generates an S3 presigned PUT URL.
3. Browser fetches the presigned URL directly with `method: "PUT"` and the file as the body.
4. On success, the S3 object key is stored in the `resume` field.

---

## Submission

Clicking **Submit Application** on step 5 calls `handleSubmit(onSubmit)` (via `onClick` on a `type="button"` element — native form submission is disabled to prevent browser "button-swap" auto-submit bugs).

`onSubmit`:

1. Guards against accidental calls with `if (step !== STEPS.length - 1) return`.
2. Calls the `submitHackerApplication(userId, data)` server action.
3. The server action inserts into `hacker_applicants` with `onConflictDoNothing()` and returns `{ duplicate: boolean }` based on whether a row was inserted.
4. On `duplicate: true` → shows the "Already Applied" screen.
5. On `duplicate: false` → clears the localStorage draft and shows the "Application Submitted" screen.
6. Errors are logged to the console; the UI stays on the form (no error state is currently surfaced to the user).

### Server Action

```ts
// lib/actions/application-form.server.actions.ts
export const submitHackerApplication = async (
  userId: string,
  data: HackerApplicationFormData,
): Promise<{ duplicate: boolean }>
```

Inserts into the `hacker_applicants` table via Drizzle ORM. Duplicate detection relies on the table's unique constraint on `userId` — `onConflictDoNothing()` returns an empty array when a row already exists, which maps to `duplicate: true`.

---

## Post-Submission States

| State     | Trigger                  | UI                                                        |
| --------- | ------------------------ | --------------------------------------------------------- |
| Success   | `submitSuccess === true` | "Application Submitted!" screen with a Return Home button |
| Duplicate | `isDuplicate === true`   | "Already Applied!" screen with a Return Home button       |

---

## Navigation

| Button             | Type            | Behavior                                                                |
| ------------------ | --------------- | ----------------------------------------------------------------------- |
| Back               | `type="button"` | `setStep(s - 1)` — no validation, always allowed                        |
| Continue           | `type="button"` | Calls `trigger(stepFields)`; advances only if valid                     |
| Submit Application | `type="button"` | Calls `handleSubmit(onSubmit)` — validates all fields before submitting |

The form's `<form>` element has `onSubmit={(e) => e.preventDefault()}` so pressing Enter in any input field never triggers native submission.

---

## Zod Schema

Defined in `lib/types/applications.ts` as `hackerApplicationSchema` (aliased from `baseApplicationSchema`). The same schema backs both hacker and judge applications. The full TypeScript type is inferred as `HackerApplicationFormData`.

React Hook Form is configured with:

- `resolver: zodResolver(hackerApplicationSchema)`
- `mode: "onChange"` — validation runs on every field change so inline errors appear immediately
