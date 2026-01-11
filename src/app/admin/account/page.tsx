import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AccountSettings } from "@/components/admin/account-settings";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Account Settings</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Manage your account and security settings
        </p>
      </div>

      <AccountSettings email={session.user.email} />
    </div>
  );
}
