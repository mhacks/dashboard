import Image from "next/image";

export default function MlhTrustBadge() {
  return (
    <a
      id="mlh-trust-badge"
      style={{
        display: "block",
        maxWidth: "100px",
        minWidth: "60px",
        position: "absolute",
        right: "1.5rem",
        bottom: "1.5rem",
        width: "10%",
        zIndex: 10000,
      }}
      href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2026-season&utm_content=black"
      target="_blank"
      rel="noreferrer"
    >
      <Image
        src="https://logged-assets.s3.amazonaws.com/trust-badge/2027/mlh-trust-badge-2027-black.svg"
        alt="Major League Hacking 2026 Hackathon Season"
        width={393}
        height={688}
        unoptimized
        className="h-auto w-full"
      />
    </a>
  );
}
