import { useCallback, useState } from "react";

export function useSelectionSet(initial: Iterable<string> = []) {
  const [selected, setSelected] = useState(() => new Set(initial));

  const toggle = useCallback((item: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(item);
      } else {
        next.delete(item);
      }
      return next;
    });
  }, []);

  const setItems = useCallback((items: string[]) => {
    setSelected(new Set(items));
  }, []);

  const addMany = useCallback((items: Iterable<string>) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const item of items) {
        next.add(item);
      }
      return next.size === current.size ? current : next;
    });
  }, []);

  const removeMany = useCallback((items: Iterable<string>) => {
    const remove = new Set(items);
    setSelected((current) => {
      const next = new Set(current);
      for (const item of remove) {
        next.delete(item);
      }
      return next.size === current.size ? current : next;
    });
  }, []);

  const reset = useCallback(() => {
    setSelected(new Set());
  }, []);

  const pruneTo = useCallback((items: Iterable<string>) => {
    const allowed = new Set(items);
    setSelected((current) => {
      const next = new Set<string>();
      for (const item of current) {
        if (allowed.has(item)) {
          next.add(item);
        }
      }
      return next.size === current.size ? current : next;
    });
  }, []);

  return { selected, toggle, setItems, addMany, removeMany, reset, pruneTo };
}
