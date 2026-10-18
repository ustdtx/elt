import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "English Tutor",
  description: "One-to-one English lessons for young learners, five to seven years old.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
