export default function GradientBlobs() {
  return (
    <>
      {/* Pink blob — left edge, vertically centered */}
      <div
        className="pointer-events-none absolute"
        aria-hidden
        style={{
          width: 727,
          height: 727,
          borderRadius: 727,
          background: "#FFBCE1",
          opacity: 0.5,
          filter: "blur(50px)",
          transform: "translateY(-50%) rotate(-90deg)",
          left: "-20%",
          top: "50%",
        }}
      />
      {/* Blue blob — right edge, vertically centered */}
      <div
        className="pointer-events-none absolute"
        aria-hidden
        style={{
          width: 727,
          height: 727,
          borderRadius: 727,
          background: "#D2E7FF",
          opacity: 0.5,
          filter: "blur(50px)",
          transform: "translateY(-50%) rotate(-15deg)",
          right: "-20%",
          top: "50%",
        }}
      />
    </>
  );
}
