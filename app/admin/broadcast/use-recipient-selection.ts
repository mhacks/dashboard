import { useCallback, useState } from "react";

export function useRecipientSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((recipient: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(recipient);
      } else {
        next.delete(recipient);
      }
      return next;
    });
  }, []);

  const setRecipients = useCallback((recipients: string[]) => {
    setSelected(new Set(recipients));
  }, []);

  const reset = useCallback(() => {
    setSelected(new Set());
  }, []);

  const pruneToRecipients = useCallback((recipients: Iterable<string>) => {
    const allowed = new Set(recipients);
    setSelected((current) => {
      const next = new Set<string>();
      for (const recipient of current) {
        if (allowed.has(recipient)) {
          next.add(recipient);
        }
      }
      return next.size === current.size ? current : next;
    });
  }, []);

  return { selected, toggle, setRecipients, reset, pruneToRecipients };
}
