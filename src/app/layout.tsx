import type { Metadata } from "next";
import { Inter, Geist_Mono, Fira_Code } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "MiClaw",
  description: "Claude Code configuration visualizer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} ${firaCode.variable}`}>
      <body className="bg-surface text-text font-sans antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-grid">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
