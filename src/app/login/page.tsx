"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoStrada } from "@/components/LogoStrada";
import { CampoSenha } from "@/components/CampoSenha";

const MENSAGENS_ERRO_URL: Record<string, string> = {
  usuario_sem_area:
    "Login autenticado, mas este e-mail ainda não está vinculado a nenhuma área (tabela usuario). Peça para o administrador rodar o insert com o UUID correto.",
  sem_sessao_servidor:
    "O login funcionou no navegador, mas o servidor não reconheceu a sessão (problema de cookie/sessão). Tente novamente; se persistir, avise o desenvolvedor.",
};

function FormularioLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(
    MENSAGENS_ERRO_URL[searchParams.get("erro") ?? ""] ?? null,
  );
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-strada-sidebar">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <LogoStrada className="h-10" />
        </div>
        <h1 className="mb-6 text-center text-sm text-strada-cinza">
          Credenciamento &amp; KYC — acesso interno
        </h1>
        <form onSubmit={entrar} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-strada-cinza">
              E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-black/10 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none"
            />
          </div>
          <CampoSenha
            id="senha"
            label="Senha"
            value={senha}
            onChange={setSenha}
            autoComplete="current-password"
          />
          <div className="flex justify-end">
            <Link
              href="/esqueci-senha"
              className="text-xs text-strada-cinza hover:text-strada-laranja"
            >
              Esqueci minha senha
            </Link>
          </div>
          {erro && <p className="text-xs text-strada-vinho">{erro}</p>}
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded bg-strada-laranja py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {carregando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <FormularioLogin />
    </Suspense>
  );
}
