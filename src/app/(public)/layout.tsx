import Link from "next/link";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            LendLoop
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4">{children}</main>
      <footer className="border-t">
        <p className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-muted-foreground">
          LendLoop · a neighborhood tool-lending board
        </p>
      </footer>
    </div>
  );
}
