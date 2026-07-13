import { SiteShell } from "@/components/site-shell";

export const dynamic = "force-dynamic";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SiteShell>{children}</SiteShell>;
}
