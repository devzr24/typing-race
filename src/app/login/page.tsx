import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { buttonClass } from "@/components/form-field";
import { getMessages } from "@/i18n/server";
import { signInWithProvider } from "@/lib/auth/actions";
import { GuestForm, OAuthErrorMessage, PasswordLoginForm } from "./login-forms";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.login.title} — ${m.app.name}` };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { error } = await searchParams;
  if (error === undefined && await auth()) redirect("/");
  const m = await getMessages();
  const providers = [
    { id: "github", label: m.login.github },
    { id: "discord", label: m.login.discord },
  ];

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-8 px-4 py-10">
      <h1 className="text-2xl font-semibold">{m.login.title}</h1>

      <Suspense>
        <OAuthErrorMessage />
      </Suspense>

      <section className="flex flex-col gap-3">
        {providers.map((provider) => (
          <form key={provider.id} action={signInWithProvider}>
            <input type="hidden" name="provider" value={provider.id} />
            <button type="submit" className={`${buttonClass} w-full`}>
              {provider.label}
            </button>
          </form>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{m.login.withUsername}</h2>
        <PasswordLoginForm />
        <p className="text-sm">
          {m.login.noAccount}{" "}
          <Link href="/register" className="underline">
            {m.login.createAccount}
          </Link>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{m.login.withoutAccount}</h2>
        <GuestForm />
      </section>
    </main>
  );
}
