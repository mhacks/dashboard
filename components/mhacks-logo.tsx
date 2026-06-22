import Image from "next/image";

export function MHacksLogo({
  size = 52,
  variant = "default",
}: {
  size?: number;
  variant?: "default" | "green";
}) {
  return (
    <Image
      src={variant === "green" ? "/green_logo.png" : "/mhacks_logo.png"}
      alt="MHacks logo"
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    />
  );
}
