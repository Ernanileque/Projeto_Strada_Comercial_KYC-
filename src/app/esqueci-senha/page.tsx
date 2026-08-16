"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogoStrada } from "@/components/LogoStrada";

export default function EsqueciSenhaPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviarLink(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    setCarregando(false);

    // Sempre mostramos a mesma confirmação, exista ou não o e-mail na
    // base — evita confirmar para terceiros quais e-mails têm conta.
    if (error) {
      setErro(error.message);
      return;
    }
    setEnviado(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-strada-sidebar">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <LogoStrada className="h-10" />
        </div>
        <h1 className="mb-6 text-center text-sm text-strada-cinza">
          Redefinir senha
        </h1>

        {enviado ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-strada-cinza">
              Se <strong>{email}</strong> estiver cadastrado, você vai
              receber um e-mail com um link para redefinir sua senha.
            </p>
            <Link
              href="/login"
              className="inline-block text-xs text-strada-laranja hover:underline"
            >
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={enviarLink} className="space-y-4">
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
            {erro && <p className="text-xs text-strada-vinho">{erro}</p>}
            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded bg-strada-laranja py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {carregando ? "Enviando…" : "Enviar link de redefinição"}
            </button>
            <div className="text-center">
              <Link
                href="/login"
                className="text-xs text-strada-cinza hover:text-strada-laranja"
              >
                Voltar para o login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
