"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoStrada } from "@/components/LogoStrada";
import { CampoSenha } from "@/components/CampoSenha";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    // O link do e-mail de redefinição carrega os tokens de recuperação
    // no hash da URL; o supabase-js os detecta automaticamente e dispara
    // o evento PASSWORD_RECOVERY assim que a sessão é criada no browser.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPronto(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPronto(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function salvarNovaSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-strada-sidebar">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <LogoStrada className="h-10" />
        </div>
        <h1 className="mb-6 text-center text-sm text-strada-cinza">
          Definir nova senha
        </h1>

        {!pronto && !erro && (
          <p className="text-center text-sm text-strada-cinza">
            Validando o link de redefinição…
          </p>
        )}

        {pronto && sucesso && (
          <p className="text-center text-sm text-strada-cinza">
            Senha atualizada com sucesso. Redirecionando para o login…
          </p>
        )}

        {pronto && !sucesso && (
          <form onSubmit={salvarNovaSenha} className="space-y-4">
            <CampoSenha
              id="nova-senha"
              label="Nova senha"
              value={senha}
              onChange={setSenha}
              autoComplete="new-password"
            />
            <CampoSenha
              id="confirmar-senha"
              label="Confirmar nova senha"
              value={confirmarSenha}
              onChange={setConfirmarSenha}
              autoComplete="new-password"
            />
            {erro && <p className="text-xs text-strada-vinho">{erro}</p>}
            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded bg-strada-laranja py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {carregando ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
