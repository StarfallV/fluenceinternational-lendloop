import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <section className="flex justify-center py-12">
      {/* Clerk routes its steps by the URL, which is only known at request time (Cache Components). */}
      <Suspense fallback={<p className="text-muted-foreground">Loading sign-in…</p>}>
        {/* One page for signing in and signing up. */}
        <SignIn withSignUp />
      </Suspense>
    </section>
  );
}
