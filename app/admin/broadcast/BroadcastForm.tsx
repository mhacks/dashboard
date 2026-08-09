"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { broadcastAll } from "./actions";

const BODY_LIMIT = 160;

export default function BroadcastForm({
  hackerCount,
}: {
  hackerCount: number;
}) {
  const [bodyLength, setBodyLength] = useState(0);

  return (
    <form
      action={broadcastAll}
      onSubmit={(e) => {
        if (
          !confirm(`This will email all ${hackerCount} hackers. Are you sure?`)
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="broadcast-subject">Subject</Label>
        <Input id="broadcast-subject" name="subject" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="broadcast-body">Body</Label>
        <Textarea
          id="broadcast-body"
          name="body"
          rows={5}
          required
          maxLength={BODY_LIMIT}
          onChange={(e) => setBodyLength(e.target.value.length)}
        />
        <p className="text-sm text-muted-foreground">
          {bodyLength} / {BODY_LIMIT}
        </p>
      </div>

      <Button type="submit" className="self-start">
        Send to All Hackers
      </Button>
    </form>
  );
}
