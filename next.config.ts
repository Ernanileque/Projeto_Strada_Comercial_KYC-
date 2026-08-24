import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os modelos .docx do Jurídico são lidos via fs.readFile em runtime (não
  // por import), então o rastreador de arquivos da Vercel não os inclui
  // automaticamente no bundle da função sem essa declaração explícita.
  outputFileTracingIncludes: {
    "/**": ["./src/lib/juridico/templates/**"],
  },
};

export default nextConfig;
