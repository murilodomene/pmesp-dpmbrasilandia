import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AreaInternaLayout } from "@/components/AreaInternaMenu";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const [{ data: profile }, { data: role }] = await Promise.all([
      supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle(),
    ]);
    if ((profile?.status !== "ativo" || !role?.role) && location.pathname !== "/pendente") {
      throw redirect({ to: "/pendente" });
    }
    return { user: data.user };
  },
  component: () => (
    <AreaInternaLayout>
      <Outlet />
    </AreaInternaLayout>
  ),
});
