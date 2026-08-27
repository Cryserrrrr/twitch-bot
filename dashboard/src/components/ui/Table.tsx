import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className={cn("w-full text-sm", className)}>{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "border-b border-line px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-faint",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("border-b border-line/60 px-4 py-3 text-ink", className)}>
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("transition-colors hover:bg-elevated/60", className)}>
      {children}
    </tr>
  );
}
