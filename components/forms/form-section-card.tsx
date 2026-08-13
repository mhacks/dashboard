import type { CSSProperties, ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export const FORM_SECTION_CARD_CLASS = "shadow-none";
export const FORM_SECTION_CARD_STYLE = {
  borderColor: "rgba(58,74,38,0.15)",
} satisfies CSSProperties;
export const FORM_SECTION_CONTENT_CLASS = "space-y-4 font-red-hat";

export function FormSectionCard({
  children,
  contentClassName = FORM_SECTION_CONTENT_CLASS,
}: {
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card className={FORM_SECTION_CARD_CLASS} style={FORM_SECTION_CARD_STYLE}>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
