import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Альфа-Бизнес · Бизнес-инсайты",
  description: "Персональная аналитика для руководителей компаний. Прототип хакатона.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
