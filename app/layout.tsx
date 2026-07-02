import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "狼狼按鈕",
  description: "雙向、低阻力、按鈕式、跨語言情境溝通字卡工具。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
