"use client";

import { useState } from "react";
import { obterLinkDocumento } from "./actions";

export function VerDocumentoBotao({ caminho }: { caminho: string }) {
  const [carregando, setCarregando] = useState(false);

  async function abrir() {
    setCarregando(true);
    const url = await obterLinkDocumento(caminho);
    setCarregando(false);
    if (!url) {
      alert("Não foi possível abrir o documento.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={carregando}
      className="text-xs font-medium text-strada-laranja hover:underline disabled:opacity-60"
    >
      {carregando ? "Abrindo…" : "Ver documento"}
    </button>
  );
}
