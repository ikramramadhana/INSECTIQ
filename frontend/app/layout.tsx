import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InsectIQ — AI-Powered Insect Identification",
  description: "Identifikasi serangga otomatis berbasis AI dengan insights mendalam dari Gemini.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
