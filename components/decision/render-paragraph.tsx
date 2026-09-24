/**
 * Letter copy marks emphasis with **double asterisks** — currently just the
 * travel reimbursement amount. Splitting on a capturing group puts the marked
 * spans at the odd indices, which are the ones that get bolded.
 *
 * Kept as a marker in lib/decisions.ts rather than markup so that module stays
 * plain data and can be read by anything, not just React.
 */
export function renderParagraph(paragraph: string) {
  return paragraph.split(/\*\*(.+?)\*\*/g).map((segment, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {segment}
      </strong>
    ) : (
      segment
    ),
  );
}
