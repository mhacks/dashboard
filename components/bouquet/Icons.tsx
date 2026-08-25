/* Stroke-only 20px icons. Paths live in one place so the rail, the action
   pills and anything added later stay visually consistent. */

export type IconName =
  | "rotateL"
  | "rotateR"
  | "raise"
  | "lower"
  | "forward"
  | "back"
  | "flip"
  | "trash"
  | "reset"
  | "random";

const PATHS: Record<IconName, React.ReactNode> = {
  /* An object with an arc sweeping over it. Two things this had to dodge: a
     bare circular arrow reads as undo/redo (and ⌘Z really is undo here), while
     an arc whose ends land on the object's top corners reads as a padlock
     shackle. So the arc overhangs the object and stands clear of it. */
  rotateL: (
    <>
      <rect x="5.2" y="11.4" width="9.6" height="5.8" rx="1.6" />
      <path d="M16.2 9a6.2 6.2 0 0 0-12.4 0" />
      <path d="M6.7 7.7 4.6 9.3 3.2 7.1" />
    </>
  ),
  rotateR: (
    <>
      <rect x="5.2" y="11.4" width="9.6" height="5.8" rx="1.6" />
      <path d="M3.8 9a6.2 6.2 0 0 1 12.4 0" />
      <path d="M14.3 7.7 16.2 9.3 17.7 7.1" />
    </>
  ),
  raise: (
    <>
      <path d="M10 16.5V4.2" />
      <path d="M5.6 8.6 10 4.2l4.4 4.4" />
    </>
  ),
  lower: (
    <>
      <path d="M10 3.5v12.3" />
      <path d="M14.4 11.4 10 15.8l-4.4-4.4" />
    </>
  ),
  forward: (
    <>
      <rect x="7.4" y="2.9" width="9.7" height="9.7" rx="2" />
      <path d="M12.6 15.6a2 2 0 0 1-2 1.5H4.9a2 2 0 0 1-2-2V9.4a2 2 0 0 1 1.5-2" />
    </>
  ),
  back: (
    <>
      <rect x="2.9" y="7.4" width="9.7" height="9.7" rx="2" />
      <path d="M7.4 4.4a2 2 0 0 1 2-1.5h5.7a2 2 0 0 1 2 2v5.7a2 2 0 0 1-1.5 2" />
    </>
  ),
  flip: (
    <>
      <path d="M10 2.6v14.8" strokeDasharray="2.4 2.4" />
      <path d="M7.7 5.6 3.1 10l4.6 4.4z" />
      <path d="M12.3 5.6 16.9 10l-4.6 4.4z" />
    </>
  ),
  trash: (
    <>
      <path d="M3.9 5.4h12.2" />
      <path d="M8.1 5.4V3.6h3.8v1.8" />
      <path d="M5.4 5.4l.8 10a1.6 1.6 0 0 0 1.6 1.5h4.4a1.6 1.6 0 0 0 1.6-1.5l.8-10" />
      <path d="M8.6 8.6v5.2M11.4 8.6v5.2" />
    </>
  ),
  reset: (
    <>
      <path d="M15.6 9.2A5.9 5.9 0 1 0 14.4 14" />
      <path d="M16.6 5.2v4.3h-4.2" />
    </>
  ),
  random: (
    <>
      <path d="M10 2.6l1.5 3.9 3.9 1.5-3.9 1.5L10 13.4 8.5 9.5 4.6 8l3.9-1.5z" />
      <path d="M15.1 12.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.55}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
