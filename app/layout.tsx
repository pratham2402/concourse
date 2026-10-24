import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concourse: per-stand concession mix",
  description:
    "A Qloo-powered concession planner that shows stadium operators which local partners belong in each stand and what the switch is worth.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
