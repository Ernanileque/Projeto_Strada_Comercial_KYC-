import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { BotaoSair } from "@/components/BotaoSair";
import { AREAS, type Area } from "@/lib/areas";

export default async function LayoutInterno({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?erro=sem_sessao_servidor");
  }

  const { data: usuario } = await supabase
    .from("usuario")
    .select("nome, area")
    .eq("id", user.id)
    .single();

  if (!usuario) {
    redirect("/login?erro=usuario_sem_area");
  }

  const area = usuario.area as Area;

  return (
    <div className="flex h-screen w-full">
      <Sidebar areaAtual={area} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 shrink-0 flex items-center justify-between border-b border-black/10 bg-white px-6">
          <h1 className="text-sm font-medium text-strada-cinza">
            {AREAS[area].label}
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">{usuario.nome}</span>
            <BotaoSair />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
