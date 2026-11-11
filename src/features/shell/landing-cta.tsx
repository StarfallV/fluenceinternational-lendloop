"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/** PUB-3: starts Clerk sign-in, or opens the app for a visitor who is already signed in. */
export function LandingCta() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    // Holds the button's height while Clerk loads, so the page doesn't shift.
    return <div aria-hidden="true" className="h-9" />;
  }
  return isSignedIn ? (
    <Link href="/tools" className={buttonVariants({ size: "lg" })}>
      Open LendLoop
    </Link>
  ) : (
    <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
      Sign in to lend or borrow
    </Link>
  );
}
