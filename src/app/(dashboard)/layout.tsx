import { getUserProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getUserProfile()

  if (!profile) redirect("/login")
  if (!profile.center_id) redirect("/pending")
  if (profile.active === false) redirect("/inactive")

  const supabase = await createClient()

  // Redirect to change-password page if it's the user's first login
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.user_metadata?.must_change_password) redirect("/change-password")

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
