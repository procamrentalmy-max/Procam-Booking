import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProCam",
  description: "Action camera and underwater equipment rental for hotel and hostel guests.",
  // The uploaded logo (Branding) on a white tile, served by app/brand-icon/route.ts
  icons: { icon: [{ url: "/brand-icon", type: "image/png", sizes: "256x256" }], apple: [{ url: "/brand-icon", sizes: "256x256" }] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
