"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type Area } from "@/lib/areas";
import { LogoStrada } from "@/components/LogoStrada";

export function Sidebar({ areaAtual }: { areaAtual: Area }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-strada-sidebar text-gray-300 flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-white/10">
        <LogoStrada />
      </div>
      <nav className="flex-1 py-3">
        {NAV_ITEMS.map((item) => {
          const ativo = pathname.startsWith(item.rota);
          const ehAreaDoUsuario = item.area === areaAtual;
          return (
            <Link
              key={item.rota}
              href={item.rota}
              className={`flex items-center gap-2 px-4 py-2 text-sm border-l-2 transition-colors ${
                ativo
                  ? "border-strada-laranja bg-white/5 text-white"
                  : "border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
              {ehAreaDoUsuario && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-strada-laranja" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
