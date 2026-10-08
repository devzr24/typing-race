import type { Metadata } from "next";
import { JetBrains_Mono, Monoton, Nunito, Righteous } from "next/font/google";
import { ClueNetwork } from "@/components/clue-network";
import { EFFECTS_BOOT_SCRIPT, FeedbackProvider, Intro } from "@/components/effects";
import { SiteHeader } from "@/components/site-header";
import { I18nProvider } from "@/i18n/client";
import { getFeedbackPreferences, getLocale, getMessages, getTheme } from "@/i18n/server";
import "./globals.css";

// Polices de la direction artistique ; leur usage est défini dans globals.css.
const monoton = Monoton({ weight: "400", subsets: ["latin"], variable: "--font-monoton" });
const righteous = Righteous({ weight: "400", subsets: ["latin"], variable: "--font-righteous" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const fontVariables = [monoton, righteous, nunito, jetbrainsMono].map((f) => f.variable).join(" ");

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.app.name, description: m.app.tagline };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, theme, m, feedback] = await Promise.all([
    getLocale(),
    getTheme(),
    getMessages(),
    getFeedbackPreferences(),
  ]);
  return (
    // Classes de thème et d'effets rendues côté serveur depuis les cookies : pas de flash.
    // suppressHydrationWarning : le script de démarrage ajoute des classes avant React.
    <html
      lang={locale}
      className={`${fontVariables} h-full antialiased ${theme ?? ""} ${feedback.effects ? "" : "fx-off"}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: EFFECTS_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>
          <FeedbackProvider initialSound={feedback.sound} initialEffects={feedback.effects}>
            <Intro name={m.app.name} />
            {/* Réseau d'indices : au-dessus de la route, derrière le contenu (.above-effects). */}
            <ClueNetwork />
            <div className="above-effects">
              <SiteHeader theme={theme} />
            </div>
            <div className="above-effects flex-1">{children}</div>
            {/* Route néon décorative, toujours après le contenu : jamais sous le texte. */}
            <div className="road" aria-hidden="true">
              <div className="road-grid">
                <div className="road-lines" />
              </div>
            </div>
          </FeedbackProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
