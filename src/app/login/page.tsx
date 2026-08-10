"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoStrada } from "@/components/LogoStrada";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
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
      setErro("E-mail ou senha inválidos.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-strada-sidebar">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <LogoStrada className="[&_span]:text-strada-vinho" />
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
          <div>
            <label className="mb-1 block text-xs font-medium text-strada-cinza">
              Senha
            </label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded border border-black/10 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none"
            />
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
