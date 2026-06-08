import Link from "next/link";

// Shown when magic-link verification fails (expired or already-used link).
export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-black">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Login link invalid
        </h1>
        <p className="text-sm text-muted-foreground">
          That link has expired or was already used. Request a new one.
        </p>
        <Link href="/example/login" className="text-sm font-medium underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
