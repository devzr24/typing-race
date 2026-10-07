import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/auth";
import { buttonClass } from "@/components/form-field";
import { logout } from "@/lib/auth/actions";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <Link href="/" className="font-semibold">
        Typing Race
      </Link>
      {/* La session est lue à chaque requête : elle doit rester derrière un Suspense. */}
      <Suspense fallback={<span className="h-8" />}>
        <UserMenu />
      </Suspense>
    </header>
  );
}

async function UserMenu() {
  // auth() utilise une valeur aléatoire avant de lire les cookies : on se place
  // explicitement au moment de la requête pour que Next ne tente pas de le pré-rendre.
  await connection();
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return (
      <Link href="/login" className={buttonClass}>
        Connexion
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {user.image ? (
        <Image
          src={user.image}
          alt=""
          width={32}
          height={32}
          className="rounded-full"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium uppercase dark:bg-zinc-800"
        >
          {user.username.charAt(0)}
        </span>
      )}
      <span className="font-medium">{user.username}</span>
      {user.isGuest ? <span className="text-sm text-zinc-500">(invité)</span> : null}
      <form action={logout}>
        <button type="submit" className={buttonClass}>
          Déconnexion
        </button>
      </form>
    </div>
  );
}
