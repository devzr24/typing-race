import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClass } from "@/components/form-field";
import { signInWithProvider } from "@/lib/auth/actions";
import { GuestForm, OAuthErrorMessage, PasswordLoginForm } from "./login-forms";

export const metadata: Metadata = { title: "Connexion — Typing Race" };

const PROVIDERS = [
  { id: "github", label: "Continuer avec GitHub" },
  { id: "discord", label: "Continuer avec Discord" },
];

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-8 px-4 py-10">
      <h1 className="text-2xl font-semibold">Connexion</h1>

      <Suspense>
        <OAuthErrorMessage />
      </Suspense>

      <section className="flex flex-col gap-3">
        {PROVIDERS.map((provider) => (
          <form key={provider.id} action={signInWithProvider}>
            <input type="hidden" name="provider" value={provider.id} />
            <button type="submit" className={`${buttonClass} w-full`}>
              {provider.label}
            </button>
          </form>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Avec un nom d&apos;utilisateur</h2>
        <PasswordLoginForm />
        <p className="text-sm">
          Pas encore de compte ?{" "}
          <Link href="/register" className="underline">
            Créer un compte
          </Link>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Sans compte</h2>
        <GuestForm />
      </section>
    </main>
  );
}
