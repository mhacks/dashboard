# Early/Accidental Submission Bug

## Root Cause

The entire multi-step form is wrapped in a single `<form onSubmit={handleSubmit(onSubmit)}>` tag. The `onSubmit` callback had **no guard checking which step the user is on**.

If a form submit event fires on any step — the most common trigger being pressing **Enter** inside a text input while all fields are already valid from a localStorage restore — `handleSubmit` validates the full form, finds it valid (because agreements were pre-checked in localStorage), and calls `onSubmit`, submitting early.

### Why it only happens with agreements pre-checked

`handleSubmit` (react-hook-form) validates **all registered fields at once**, not just the current step's fields. The agreement fields (`mlhCodeOfConduct`, `mlhPrivacyPolicy`, `mlhEmails`) all use `.refine((val) => val === true, ...)`. If those are `false` (not yet checked), `handleSubmit` returns a validation error and `onSubmit` is never called. But when they're already `true` from a localStorage restore, the whole form is valid and `onSubmit` fires immediately on any submit event.

### Trigger path

1. User previously checked all agreements (even without submitting)
2. Agreements state is saved to localStorage by the `watch` subscription
3. User reloads — `useEffect` restores all form data including `mlhCodeOfConduct: true` etc.
4. User clicks through steps, pressing Enter in a text input on any step
5. Browser fires a form submit event → `handleSubmit` validates everything → all valid → `onSubmit` called → application submitted on wrong step

## Secondary Bug (fixed alongside)

`submitHackerApplication` was called with a **hardcoded UUID** instead of `profileId`:
```ts
// Before (wrong)
await submitHackerApplication("6fb4e643-baea-4a96-bf9b-4bc863ad760e", data);

// After (correct)
await submitHackerApplication(profileId, data);
```

## Fix

Added a step guard as the first line of `onSubmit` in `application-form.tsx`:
```ts
const onSubmit = async (data: HackerApplicationFormData) => {
  if (step !== STEPS.length - 1) return; // must be on final step
  // ...
};
```

Also fixed the hardcoded userId to use `profileId`.
