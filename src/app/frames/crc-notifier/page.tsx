import { Metadata } from "next";
import App from "~/app/app";

const appUrl = process.env.NEXT_PUBLIC_URL;

const frame = {
  version: "next",
  imageUrl: `${appUrl}/frames/crc-notifier/opengraph-image`,
  button: {
    title: "Launch CRC Notifier",
    action: {
      type: "launch_frame",
      name: "CRC Notifier",
      url: `${appUrl}/frames/crc-notifier/`,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
    },
  },
};

export const metadata: Metadata = {
  title: "CRC Notifier - Remind Friends to Redeem",
  description:
    "Check your Circles trust network and remind friends to redeem their daily CRC allocations",
  openGraph: {
    title: "CRC Notifier",
    description:
      "Remind your trusted connections to redeem their daily CRC allocations",
  },
  other: {
    "fc:frame": JSON.stringify(frame),
  },
};

export default function CRCNotifierFrame() {
  return <App title={"CRC Notifier"} />;
}
