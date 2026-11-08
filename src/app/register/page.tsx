import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getMessages } from "@/i18n/server";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.register.title} — ${m.app.name}` };
}

export default async function RegisterPage() {
  if (await auth()) redirect("/");
  const m = await getMessages();
  return (
    <main id="contenu" tabIndex={-1} className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">{m.register.title}</h1>
      <p className="text-sm text-mist">{m.register.noEmail}</p>
      <RegisterForm />
      <p className="text-sm">
        {m.register.haveAccount}{" "}
        <Link href="/login" className="underline">
          {m.register.login}
        </Link>
      </p>
    </main>
  );
}
