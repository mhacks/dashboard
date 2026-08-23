import { ButtonLink } from "@/components/console/button";

export function RsvpButton({ deadline }: { deadline?: string }) {
  return (
    <div className="mt-5.5 flex flex-wrap items-center gap-3.5">
      <ButtonLink href="/rsvp" external={false}>
        Confirm My RSVP
      </ButtonLink>

      <p className="font-red-hat-mono text-[11.5px] tracking-[0.04em] text-ui-ink-soft max-sm:w-full">
        {deadline ? `RSVP by ${deadline}` : null}
      </p>
    </div>
  );
}
