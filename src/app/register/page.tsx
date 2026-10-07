import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Inscription — Typing Race" };

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Créer un compte</h1>
      <p className="text-sm text-zinc-500">Aucun courriel n&apos;est demandé.</p>
      <RegisterForm />
      <p className="text-sm">
        Déjà un compte ?{" "}
        <Link href="/login" className="underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
