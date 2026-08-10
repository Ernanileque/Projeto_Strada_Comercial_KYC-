export function LogoStrada({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M2 21 12 3l10 18H2Z" fill="#F25929" />
      </svg>
      <span className="font-semibold tracking-tight text-white">Strada</span>
    </div>
  );
}
