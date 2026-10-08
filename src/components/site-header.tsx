import { LogOut } from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { Avatar } from "@/components/avatar";
import { buttonClass } from "@/components/form-field";
import { EffectsToggle, SoundToggle } from "@/components/effects";
import { LanguageSelect, ThemeSelect } from "@/components/preferences";
import type { Theme } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { logout } from "@/lib/auth/actions";

export async function SiteHeader({ theme }: { theme: Theme | null }) {
  const [m, session] = await Promise.all([getMessages(), auth()]);
  const user = session?.user;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
      <Link href="/" className="font-logo text-2xl">
        {m.app.name}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <LanguageSelect />
        <ThemeSelect theme={theme} />
        <SoundToggle />
        <EffectsToggle />
        {user ? (
          <div className="flex items-center gap-2">
            <Avatar name={user.username} image={user.image} />
            <span className="font-medium">{user.username}</span>
            {user.isGuest ? <span className="text-sm text-ink/70">{m.header.guest}</span> : null}
            <form action={logout}>
              <button type="submit" className="icon-frame" aria-label={m.header.logout} title={m.header.logout}>
                <LogOut size={18} aria-hidden="true" />
              </button>
            </form>
          </div>
        ) : (
          <Link href="/login" className={buttonClass}>
            {m.header.login}
          </Link>
        )}
      </div>
    </header>
  );
}
