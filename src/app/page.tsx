import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AREAS, type Area } from "@/lib/areas";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?erro=sem_sessao_servidor");
  }

  const { data: usuario } = await supabase
    .from("usuario")
    .select("area")
    .eq("id", user.id)
    .single();

  redirect(
    usuario ? AREAS[usuario.area as Area].rota : "/login?erro=usuario_sem_area",
  );
}
