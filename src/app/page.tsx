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

  const { data: usuario, error: erroUsuario } = await supabase
    .from("usuario")
    .select("area")
    .eq("id", user.id)
    .single();

  if (usuario) {
    redirect(AREAS[usuario.area as Area].rota);
  }

  const detalhe = encodeURIComponent(
    `${erroUsuario?.code ?? "sem_codigo"}: ${erroUsuario?.message ?? "sem mensagem"}`,
  );
  redirect(`/login?erro=usuario_sem_area&uid=${user.id}&detalhe=${detalhe}`);
}
