import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getMessages, getTheme } from "@/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.app.name, description: m.app.tagline };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  return (
    // Classe du thème rendue côté serveur depuis le cookie : pas de flash au chargement.
    <html lang={locale} className={`h-full antialiased ${theme ?? ""}`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>
          <SiteHeader theme={theme} />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
