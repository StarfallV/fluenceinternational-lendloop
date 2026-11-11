import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { ConvexClientProvider } from "@/features/shell/convex-client-provider";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "LendLoop",
  description: "Borrow what you need. Lend what you don't.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {/* Not `dynamic`: auth state loads in the browser, so pages stay static (Cache Components). */}
        <ClerkProvider
          signInUrl="/sign-in"
          signInFallbackRedirectUrl="/tools"
          signUpFallbackRedirectUrl="/tools"
          afterSignOutUrl="/"
        >
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
