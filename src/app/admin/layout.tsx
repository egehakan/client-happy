import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { MobileHeader } from "@/components/admin/mobile-header";
import { Toaster } from "@/components/ui/sonner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <MobileHeader />
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      <Toaster />
    </div>
  );
}
