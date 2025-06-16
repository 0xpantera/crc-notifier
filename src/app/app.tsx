"use client";

import dynamic from "next/dynamic";
import ReactDOM from "react-dom";

const Demo = dynamic(() => import("~/components/Demo"), {
  ssr: false,
});

const CRCNotifier = dynamic(
  () =>
    import("~/components/crc-notifier").then((mod) => ({
      default: mod.CRCNotifier,
    })),
  {
    ssr: false,
  },
);

export default function App(
  { title }: { title?: string } = {
    title: "DappCon Mini App Template",
  },
) {
  ReactDOM.preconnect("https://auth.farcaster.xyz");

  // Show CRC Notifier for the specific frame
  if (title === "CRC Notifier") {
    return <CRCNotifier />;
  }

  return <Demo title={title} />;
}
