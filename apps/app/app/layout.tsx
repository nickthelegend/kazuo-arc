import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { TopBar } from "@/components/top-bar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "Xorv — AI job board", template: "%s · Xorv" },
  description:
    "Post an AI job, pay per job in USDC over x402 on Hedera, and watch it run on a live provider node.",
  icons: { icon: [{ url: "/brand/xorv-mark.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = { themeColor: "#07070b", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased bg-background text-foreground">
        <TopBar />
        <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-6">{children}</main>
      </body>
    </html>
  );
}
