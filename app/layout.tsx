import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible: designed for maximum legibility, which is the point of this product.
const reading = Atkinson_Hyperlegible({
  variable: "--font-reading",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Second Ear",
  description: "Re-delivers a lecture in plain English, read aloud slowly, then checks you understood it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f3ec",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${reading.variable} antialiased`}>{children}</body>
    </html>
  );
}
