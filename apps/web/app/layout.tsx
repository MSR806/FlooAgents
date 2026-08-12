import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { cn } from "@/lib/utils";

// Display is titles-only — Archivo 900 is muddy below ~1.5rem.
const display = Archivo({ subsets: ["latin"], weight: ["800", "900"], variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://flooagents.com"),
  alternates: {
    canonical: "/",
  },
  title: "Floo Agents",
  description: "Any agent. Any harness. Any channel.",
  applicationName: "Floo Agents",
  icons: {
    icon: {
      url: "/brand/floo-agents-favicon.png",
      sizes: "64x64",
      type: "image/png",
    },
    apple: {
      url: "/brand/floo-agents-apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
  openGraph: {
    title: "Floo Agents",
    description: "Any agent. Any harness. Any channel.",
    type: "website",
    images: [
      {
        url: "/brand/floo-agents-owl-sitting.png",
        width: 1254,
        height: 1254,
        alt: "Floo Agents owl mascot",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn("font-sans", display.variable, sans.variable, mono.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint, so Ink users never flash Paper. */}
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: pre-paint theme, must be inline */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <SidebarTrigger className="fixed top-3 left-3 z-40 md:hidden" />
            <main className="mx-auto w-full max-w-6xl flex-1 p-6 pt-14 md:p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
