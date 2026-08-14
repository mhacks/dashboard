import { ButtonLink } from "@/components/console/button";
import {
  LetterBody,
  LetterHeading,
  LetterKicker,
  Showcase,
} from "@/components/console/letter";

/**
 * Its own band rather than a second button under RSVP: the pass needs room to
 * say what it is, and a section can do that without taking weight from the one
 * action that has a deadline. The button is `secondary` for the same reason.
 *
 * Before the event details on purpose — it belongs with the things to do, and
 * the details are reference material on the way to the sign-off.
 */
export function BoardingPassSection() {
  return (
    <>
      <LetterKicker>Optional &amp; Fun</LetterKicker>
      <LetterHeading>Show off your acceptance</LetterHeading>

      <Showcase
        image="/decision/preview-boarding-pass.jpg"
        caption="The boarding pass studio"
      >
        <LetterBody>
          We built you a boarding pass. Add your name, your home city, and a few
          stickers, then download it as a PNG to post wherever you like. It
          takes about a minute, it&rsquo;s completely optional, and
          there&rsquo;s no wrong way to build one.
        </LetterBody>
        <LetterBody>
          Tag us on social media for a chance to be featured; @mhacks on X,
          @mhacks_ on Instagram.
        </LetterBody>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <ButtonLink
            href="/dashboard/pass"
            variant="secondary"
            external={false}
          >
            Build your boarding pass
          </ButtonLink>
        </div>
      </Showcase>
    </>
  );
}
