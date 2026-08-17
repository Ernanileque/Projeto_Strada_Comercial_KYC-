"use client";

import { useState } from "react";

export function CopiarLink({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <button
      onClick={copiar}
      type="button"
      className="text-xs text-strada-laranja hover:underline"
    >
      {copiado ? "Copiado!" : "Copiar link"}
    </button>
  );
}
