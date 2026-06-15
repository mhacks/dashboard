export function MHacksLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 204 202"
      width={size}
      height={size}
      aria-label="MHacks logo"
      style={{ flexShrink: 0 }}
    >
      <rect x="0"   y="25" width="60" height="152" rx="30" fill="#1F51A6" />
      <rect x="72"  y="25" width="60" height="152" rx="30" fill="#1F51A6" />
      <rect x="144" y="25" width="60" height="152" rx="30" fill="#1F51A6" />
      <path
        transform="translate(2.413,11.413)"
        d="M9.323 8.264C21.327-3.156 40.316-2.681 51.736 9.323L94.238 54.001L73.8 74.44C62.085 86.155 62.085 105.151 73.8 116.866C78.142 121.208 83.484 123.938 89.084 125.062C82.171 124.382 75.46 121.313 70.296 115.885L8.264 50.678C-3.156 38.674-2.682 19.684 9.323 8.264Z"
        fill="#1F51A6"
      />
    </svg>
  )
}
