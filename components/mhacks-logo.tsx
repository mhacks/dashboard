import Image from "next/image";

export function MHacksLogo({ size = 52 }: { size?: number }) {
  return (
    <Image
      src="/mhacks_logo.png"
      alt="MHacks logo"
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    />
  );
}
