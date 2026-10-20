import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Header, HeaderFallback } from "@/components/Header";
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
  title: "AR Manager · Brightwater Advisory",
  description: "Accounts receivable: who owes the firm money, how late each payment is, and what to do about it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {/* The header reads ?asof= from the address bar, so it needs a Suspense boundary (Next.js 16). */}
        <Suspense fallback={<HeaderFallback />}>
          <Header />
        </Suspense>
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6 print:max-w-none print:p-0">{children}</main>
      </body>
    </html>
  );
}
