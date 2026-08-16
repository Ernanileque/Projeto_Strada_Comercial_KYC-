"use client";

import { useState } from "react";

function IconeOlho() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconeOlhoFechado() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.5 6.7C3.8 8.3 2 12 2 12s4 7 11 7c1.9 0 3.5-.5 4.8-1.2M17.8 17.9C20.4 16.2 22 12 22 12s-1.7-3-4.9-4.9C15.6 5.9 13.9 5 12 5c-.7 0-1.3.1-1.9.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CampoSenha({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  autoComplete?: string;
}) {
  const [mostrar, setMostrar] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-medium text-strada-cinza"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={mostrar ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-black/10 px-3 py-2 pr-10 text-sm focus:border-strada-laranja focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          tabIndex={-1}
          aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-strada-cinza hover:text-strada-vinho"
        >
          {mostrar ? <IconeOlhoFechado /> : <IconeOlho />}
        </button>
      </div>
    </div>
  );
}
