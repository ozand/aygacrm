export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/features/sidebar";
import { Header } from "@/components/features/header";
import { SeedInitializer } from "@/components/features/seed-initializer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SeedInitializer />
      <Sidebar />
      <div className="lg:pl-64">
        <Header user={session.user} />
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
