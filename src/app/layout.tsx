import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { LanguageProvider, type Language } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NyayMitra | Legal Self-Help Assistant",
  description:
    "AI-powered legal self-help and case-preparation assistant for cyber fraud complaints in Bharat.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get("nyaymitra_language")?.value;
  const initialLanguage: Language | undefined =
    langCookie === "hi" || langCookie === "hinglish" || langCookie === "en"
      ? langCookie
      : undefined;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-950 flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem("nyaymitra_language");if(l&&document.cookie.indexOf("nyaymitra_language=")===-1){document.cookie="nyaymitra_language="+encodeURIComponent(l)+";path=/;max-age=31536000;SameSite=Lax";}}catch(e){}})();`,
          }}
        />
        <LanguageProvider initialLanguage={initialLanguage}>{children}</LanguageProvider>
      </body>
    </html>
  );
}