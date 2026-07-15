import { cookies } from "next/headers";
import { LanguageProvider, type Language } from "@/lib/i18n";

export async function LanguageProviderWrapper({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get("nyaymitra_language")?.value;
  const initialLanguage: Language | undefined =
    langCookie === "hi" || langCookie === "hinglish" || langCookie === "en"
      ? langCookie
      : undefined;

  return <LanguageProvider initialLanguage={initialLanguage}>{children}</LanguageProvider>;
}