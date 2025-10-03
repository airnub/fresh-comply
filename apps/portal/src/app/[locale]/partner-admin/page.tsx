import { redirect } from "next/navigation";

export default async function PartnerAdminIndex({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/partner-admin/branding`);
}
