import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ResourceDesk", template: "%s · ResourceDesk" },
  description: "Book shared rooms and equipment without double-bookings.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const collapsed = (await cookies()).get("sidebar-collapsed")?.value === "1";
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <TooltipProvider delayDuration={300}>
          <AppShell initialCollapsed={collapsed}>{children}</AppShell>
        </TooltipProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
