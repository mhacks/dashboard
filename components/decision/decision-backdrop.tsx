/**
 * The photograph behind a decision letter.
 *
 * Which image loads is decided entirely in CSS from the nearest
 * [data-decision] ancestor (see app/globals.css), so the decision path ships
 * no client JavaScript and the letter stays a server component.
 *
 * One layer, not two: the scrim that used to sit over this is gone. The
 * console sheet separates itself from the photograph with a hairline and a
 * drop shadow, and the wash only muddied the picture.
 */
export function DecisionBackdrop() {
  return (
    <div
      aria-hidden
      className="backdrop-photo fixed inset-0 -z-20 bg-moss bg-cover bg-center bg-no-repeat"
    />
  );
}
