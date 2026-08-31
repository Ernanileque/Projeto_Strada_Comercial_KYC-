/**
 * Remove acentos e troca qualquer caractere fora de [a-zA-Z0-9._-] por "_".
 * Nomes de documentos reais costumam ter "°", "Ã", espaços etc., que o
 * Storage rejeita na chave do objeto ("Invalid key").
 */
export function sanitizarNomeArquivo(nomeArquivo: string): string {
  return nomeArquivo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}
