"use client";

import type { ToolId } from "@/lib/bouquet/bouquetReducer";
import { Icon, type IconName } from "./Icons";

export const TOOLS: { id: ToolId; icon: IconName; label: string }[] = [
  { id: "rotateL", icon: "rotateL", label: "Rotate left" },
  { id: "rotateR", icon: "rotateR", label: "Rotate right" },
  { id: "raise", icon: "raise", label: "Raise" },
  { id: "lower", icon: "lower", label: "Lower" },
  { id: "forward", icon: "forward", label: "Bring forward" },
  { id: "back", icon: "back", label: "Send back" },
  // `flip` is not in the original spec; the artwork forces it. Every stem is
  // painted leaning one way, so without a mirror the left half of the fan
  // leans wrong.
  { id: "flip", icon: "flip", label: "Mirror" },
];

type Props = {
  enabled: boolean;
  onTool: (tool: ToolId) => void;
  onRemove: () => void;
  onTip: (text: string | null, el: HTMLElement | null) => void;
};

export default function ToolRail({ enabled, onTool, onRemove, onTip }: Props) {
  return (
    <section id="rail" className={enabled ? "" : "inert"}>
      <div className="rail-tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className="tool"
            aria-label={t.label}
            onMouseEnter={(e) => onTip(t.label, e.currentTarget)}
            onMouseLeave={() => onTip(null, null)}
            onClick={() => {
              onTip(null, null);
              onTool(t.id);
            }}
          >
            <Icon name={t.icon} />
          </button>
        ))}
      </div>
      <button
        className="tool trash"
        aria-label="Remove"
        onMouseEnter={(e) => onTip("Remove", e.currentTarget)}
        onMouseLeave={() => onTip(null, null)}
        onClick={() => {
          onTip(null, null);
          onRemove();
        }}
      >
        <Icon name="trash" />
      </button>
    </section>
  );
}
