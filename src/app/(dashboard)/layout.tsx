import { getUserProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getUserProfile()

  if (!profile) redirect("/login")

  const supabase = await createClient()
  const { data: center } = await supabase
    .from("centers")
    .select("name")
    .eq("id", profile.center_id)
    .single()

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userName={profile.name}
        centerName={center?.name}
        userRole={profile.role as import("@/types").UserRole}
      />
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}
