import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kai 3D Studio – dựng video もしも tiếng Nhật",
  description: "Dựng video 3D giải thích kiểu もしも, giọng Nhật tự động, xuất MP4 1080p.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
