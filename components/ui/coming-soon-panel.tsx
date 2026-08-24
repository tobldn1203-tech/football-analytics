export function ComingSoonPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-sm border border-dashed border-[var(--color-border-strong)] px-5 py-8">
      <div className="flex items-center gap-2">
        <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">{title}</h3>
        <span className="rounded-full bg-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
          Soon
        </span>
      </div>
      <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-[var(--color-ink-faint)]">
        {description}
      </p>
    </div>
  );
}
