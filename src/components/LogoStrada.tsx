export function LogoStrada({ className = "h-7" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- svg estático simples, sem necessidade de otimização do next/image
    <img src="/strada-logo.svg" alt="Strada" className={`w-auto ${className}`} />
  );
}
