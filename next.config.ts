import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os modelos .docx (Jurídico e Comercial) são lidos via fs.readFile em
  // runtime (não por import), então o rastreador de arquivos da Vercel
  // não os inclui automaticamente no bundle da função sem isso.
  outputFileTracingIncludes: {
    "/**": ["./src/lib/juridico/templates/**", "./src/lib/comercial/templates/**"],
  },
};

export default nextConfig;
