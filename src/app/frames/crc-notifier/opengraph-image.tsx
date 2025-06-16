import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CRC Notifier";
export const size = {
  width: 600,
  height: 400,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          fontSize: 32,
          fontWeight: 600,
        }}
      >
        <div style={{ marginBottom: 20, fontSize: 60 }}>🔔</div>
        <div style={{ color: "#ffffff", marginBottom: 10 }}>CRC Notifier</div>
        <div style={{ color: "#888888", fontSize: 20 }}>
          Remind friends to redeem their daily CRC
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
