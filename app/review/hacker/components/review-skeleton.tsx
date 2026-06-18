const GRAY = {
  light: "#F3F4F6",
  mid: "#E5E7EB",
};

function Bone({
  w,
  h,
  radius = 6,
}: {
  w: string | number;
  h: number;
  radius?: number;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background: GRAY.light,
      }}
    />
  );
}

function SidebarItemSkeleton() {
  return (
    <div style={{ padding: "10px 12px", marginBottom: 2 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: GRAY.mid,
            flexShrink: 0,
          }}
        />
        <Bone w="55%" h={12} />
      </div>
      <div
        style={{
          paddingLeft: 14,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <Bone w="70%" h={10} />
        <Bone w="50%" h={10} />
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
      {/* Name + meta row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Bone w={200} h={22} />
          <Bone w={140} h={14} />
        </div>
        <Bone w={80} h={26} radius={99} />
      </div>

      {/* Pills row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[80, 70, 90, 60].map((w, i) => (
          <Bone key={i} w={w} h={22} radius={99} />
        ))}
      </div>

      {/* Essay blocks */}
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ marginBottom: 24 }}>
          <Bone w={160} h={13} radius={4} />
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <Bone w="100%" h={12} />
            <Bone w="92%" h={12} />
            <Bone w="85%" h={12} />
            <Bone w="60%" h={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewPanelSkeleton() {
  return (
    <div
      style={{
        width: 300,
        borderLeft: `1px solid ${GRAY.light}`,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${GRAY.light}`,
        }}
      >
        <Bone w={60} h={11} />
      </div>

      {/* Criteria */}
      <div
        style={{
          flex: 1,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Bone w="55%" h={12} />
            <Bone w={52} h={32} radius={6} />
          </div>
        ))}
        <div style={{ height: 1, background: GRAY.light, margin: "4px 0" }} />
        <Bone w="40%" h={12} />
        <Bone w="100%" h={64} radius={8} />
      </div>

      {/* Save button */}
      <div
        style={{ padding: "12px 20px", borderTop: `1px solid ${GRAY.light}` }}
      >
        <Bone w="100%" h={36} radius={8} />
      </div>
    </div>
  );
}

export function ReviewDashboardSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: '"Red Hat Text", system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 50,
          borderBottom: `1px solid ${GRAY.light}`,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 12,
          flexShrink: 0,
          background: "#fff",
        }}
      >
        <Bone w={28} h={28} radius={6} />
        <Bone w={100} h={14} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
          <Bone w={80} h={12} />
          <Bone w={60} h={12} />
          <Bone w={50} h={12} />
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div
          style={{
            width: 272,
            borderRight: `1px solid ${GRAY.light}`,
            display: "flex",
            flexDirection: "column",
            background: "#FAFAFA",
            flexShrink: 0,
          }}
        >
          {/* Search */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: `1px solid ${GRAY.light}`,
            }}
          >
            <Bone w="100%" h={32} radius={7} />
          </div>
          {/* Items */}
          <div style={{ flex: 1, padding: "6px 8px" }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <SidebarItemSkeleton key={i} />
            ))}
          </div>
          {/* Footer */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: `1px solid ${GRAY.light}`,
            }}
          >
            <Bone w={180} h={11} />
          </div>
        </div>

        {/* Detail */}
        <DetailSkeleton />

        {/* Review panel */}
        <ReviewPanelSkeleton />
      </div>
    </div>
  );
}
