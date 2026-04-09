import type { Metadata } from "next";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = {
  title: "Sign up — MHacks",
  description: "Create your MHacks account",
};

export default function SignupFormPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <SignupForm />
    </div>
  );
}
