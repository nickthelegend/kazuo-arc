import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { REPO_URL } from "@/lib/links";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

// The canonical, Open Graph and JSON-LD URLs all derive from this, so it must be
// a domain that resolves: it was `kazuo.network`, which does not exist.
const SITE = "https://kazuo-arc.vercel.app";
const TITLE = "Kazuo — rent out your idle AI subscription, get paid in USDC";
const DESCRIPTION =
  "Kazuo is a decentralized AI capacity network. Share the Claude, Codex or Grok quota you already pay for, run jobs from anyone on the network, and get paid per job in USDC over x402 on Arc.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s · Kazuo" },
  description: DESCRIPTION,
  applicationName: "Kazuo",
  keywords: [
    "x402",
    "Arc",
    "Circle",
    "USDC",
    "AI capacity network",
    "agent payments",
    "micropayments",
    "Claude Code",
    "machine-to-machine payments",
    "decentralized compute",
  ],
  authors: [{ name: "Kazuo", url: REPO_URL }],
  creator: "Kazuo",
  publisher: "Kazuo",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Kazuo",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "technology",
  icons: {
    icon: [{ url: "/brand/kazuo-mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/kazuo-mark.svg" }],
  },
};

/** Dark only — it matches the one palette the site actually ships. */
export const viewport: Viewport = {
  themeColor: "#07070b",
  colorScheme: "dark",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "Kazuo",
      url: SITE,
      logo: `${SITE}/brand/kazuo-logo.svg`,
      description: DESCRIPTION,
      sameAs: [REPO_URL],
    },
    {
      "@type": "SoftwareApplication",
      name: "Kazuo CLI",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "macOS, Linux, Windows",
      url: SITE,
      description:
        "Command-line provider node for the Kazuo network. Share idle AI subscription capacity and get paid per job in USDC over x402 on Arc.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased overflow-x-clip bg-background text-foreground">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
