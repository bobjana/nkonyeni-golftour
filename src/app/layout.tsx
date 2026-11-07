import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const barlow = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "Nkonyeni Golf Tour",
  description: "Live Ryder Cup–style scoring for the Nkonyeni golf tour",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Golf Tour", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b1f3a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${barlow.variable} font-sans antialiased`}>
        <div className="app-shell">{children}</div>
        <ServiceWorker />
      </body>
    </html>
  );
}
