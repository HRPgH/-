import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "올품(아르바이트) 채용 도우미",
  description: "아르바이트 채용 지원, 출근 안내 및 근무 관리",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/shiftmate-icon.svg",
    apple: "/shiftmate-icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "올품(아르바이트) 채용 도우미",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
