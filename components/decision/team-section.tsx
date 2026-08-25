import { ButtonLink } from "@/components/console/button";
import {
  LetterBody,
  LetterHeading,
  LetterKicker,
} from "@/components/console/letter";
import { MAX_TEAM_SIZE } from "@/lib/types/teams";

/**
 * A teaser, not the team UI itself: forming a team is stateful (create,
 * invite, accept) while the letter is a static document meant to be mailed
 * and reread. This band only points to /dashboard/team, same as the Discord
 * band points out rather than embedding a chat widget.
 */
export function TeamSection() {
  return (
    <>
      <LetterKicker>Next Step</LetterKicker>
      <LetterHeading>Find your team</LetterHeading>
      <LetterBody>
        Hacking with friends? Create a team or accept an invite to link up
        before the weekend starts. Teams can have up to {MAX_TEAM_SIZE} hackers,
        and you can always hack solo if you&rsquo;d rather decide once
        you&rsquo;re here.
      </LetterBody>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <ButtonLink href="/dashboard/team" variant="outline" external={false}>
          Manage your team
        </ButtonLink>
      </div>
    </>
  );
}
