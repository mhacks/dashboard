import Image from "next/image";

const DESKTOP_GRID = [
  [
    { flex: 2, src: "/c_pic1.jpg" },
    { flex: 4, src: "/c_pic2.jpg" },
    { flex: 3, src: "/c_pic3.jpg" },
  ],
  [
    { flex: 3, src: "/c_pic4.jpg" },
    { flex: 2, src: "/c_pic5.jpg" },
    { flex: 3, src: "/c_pic6.jpg" },
    { flex: 2, src: "/c_pic7.jpg" },
  ],
  [
    { flex: 4, src: "/c_pic8.jpg" },
    { flex: 2, src: "/c_pic9.jpg" },
    { flex: 3, src: "/c_pic10.jpg" },
  ],
];

const MOBILE_GRID = [
  [
    { flex: 1, src: "/c_pic1.jpg" },
    { flex: 1, src: "/c_pic2.jpg" },
  ],
  [
    { flex: 1, src: "/c_pic3.jpg" },
    { flex: 1, src: "/c_pic4.jpg" },
  ],
];

export default function PhotoGrid() {
  return (
    <>
      {/* Mobile: 2×2 */}
      <div className="flex lg:hidden h-full w-full flex-col gap-2">
        {MOBILE_GRID.map((row, rowIdx) => (
          <div key={rowIdx} className="flex flex-1 gap-2">
            {row.map(({ flex, src }, colIdx) => (
              <div
                key={colIdx}
                className="relative overflow-hidden rounded-lg shadow-sm transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-md"
                style={{ flex }}
              >
                <Image
                  src={src}
                  alt="MHacks photo"
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Desktop: 3 rows, 3–4 cols */}
      <div className="hidden lg:flex h-full w-full flex-col gap-2">
        {DESKTOP_GRID.map((row, rowIdx) => (
          <div key={rowIdx} className="flex flex-1 gap-2">
            {row.map(({ flex, src }, colIdx) => (
              <div
                key={colIdx}
                className="relative overflow-hidden rounded-lg shadow-sm transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-md"
                style={{ flex }}
              >
                <Image
                  src={src}
                  alt="MHacks photo"
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
