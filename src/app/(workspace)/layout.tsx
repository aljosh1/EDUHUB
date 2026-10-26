import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-1">
      <Sidebar email={user.email} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
