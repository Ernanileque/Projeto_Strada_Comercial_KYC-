/**
 * Máscaras de digitação: cada dígito novo entra pela direita como casa
 * decimal, então "020" vira "0,20" e "123456" vira "1.234,56" — sem
 * precisar que o usuário digite a vírgula/ponto manualmente.
 */

export function formatarMoeda(valorDigitado: string): string {
  const digitos = valorDigitado.replace(/\D/g, "");
  if (!digitos) return "";
  const numero = parseInt(digitos, 10) / 100;
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatarPercentual(valorDigitado: string): string {
  const digitos = valorDigitado.replace(/\D/g, "");
  if (!digitos) return "";
  const numero = parseInt(digitos, 10) / 100;
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
