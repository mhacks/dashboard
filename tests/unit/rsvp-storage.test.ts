import { describe, expect, it } from "vitest";

import { rsvpReceiptCopyInput } from "@/lib/rsvp/storage";

describe("rsvpReceiptCopyInput", () => {
  it("preserves source metadata instead of replacing it", () => {
    const input = rsvpReceiptCopyInput({
      bucket: "resumes",
      sourceKey: "rsvp-receipts/user/staging/upload",
      destinationKey: "rsvp-receipts/user/confirmed/upload",
    });

    expect(input).toMatchObject({
      CopySource: "resumes/rsvp-receipts/user/staging/upload",
      Key: "rsvp-receipts/user/confirmed/upload",
    });
    expect(input).not.toHaveProperty("ContentType");
    expect(input).not.toHaveProperty("MetadataDirective");
  });
});
