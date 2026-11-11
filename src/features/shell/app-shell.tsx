"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { api } from "../../../convex/_generated/api";
import { useEnsureUser } from "./use-ensure-user";

const NAV_LINKS = [
  { href: "/tools", label: "Tools" },
  { href: "/listings", label: "My listings" },
  { href: "/requests", label: "My requests" },
  { href: "/incoming", label: "Incoming" },
];
const ADMIN_LINK = { href: "/admin", label: "Admin" };

/**
 * The signed-in layout: header, navigation and the user button. Pages render only once the
 * user's Convex row exists. The Admin link is a convenience for admins; Convex enforces the role.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const account = useEnsureUser();
  const me = useQuery(api.users.me, account.status === "ready" ? {} : "skip");
  const pathname = usePathname();
  const links = me?.role === "admin" ? [...NAV_LINKS, ADMIN_LINK] : NAV_LINKS;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            LendLoop
          </Link>
          <nav
            aria-label="Main"
            className="order-last flex w-full flex-wrap gap-x-4 gap-y-1 text-sm sm:order-none sm:w-auto"
          >
            {links.map((link) => {
              const current = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "rounded-sm py-1 text-muted-foreground hover:text-foreground",
                    current && "font-medium text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {me !== undefined && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {me.displayName}
              </span>
            )}
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {account.status === "ready" ? (
          children
        ) : account.status === "failed" ? (
          <div role="alert" className="max-w-prose space-y-4">
            <p>{account.message}</p>
            {account.retry !== undefined && (
              <Button variant="outline" onClick={account.retry}>
                Try again
              </Button>
            )}
          </div>
        ) : (
          <p aria-live="polite" className="text-muted-foreground">
            Setting up your account…
          </p>
        )}
      </main>
    </div>
  );
}
