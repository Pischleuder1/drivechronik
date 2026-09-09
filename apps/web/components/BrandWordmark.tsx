type BrandWordmarkSize = "xs" | "sm" | "md" | "lg";

const sizeClasses: Record<BrandWordmarkSize, string> = {
  xs: "text-[1.2rem]",
  sm: "text-[1.7rem]",
  md: "text-[1.9rem]",
  lg: "text-[2.8rem]",
};

export function BrandWordmark({
  size = "md",
  className = "",
}: {
  size?: BrandWordmarkSize;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-baseline font-brand-mono font-bold leading-none ${sizeClasses[size]} ${className}`}
    >
      <span className="sr-only">DriveChronik</span>
      <span aria-hidden="true" className="inline-flex items-baseline">
        <span className="text-neutral-950 dark:text-white">Drive</span>
        <span className="text-sky-700 dark:text-sky-300">Chronik</span>
      </span>
    </span>
  );
}
