import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shiftmate",
  description: "출근 안내 및 근무자 관리",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/shiftmate-icon.svg",
    apple: "/shiftmate-icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Shiftmate",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
