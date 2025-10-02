import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export function Landmark<As extends ElementType = "section">({
  as,
  label,
  className,
  children,
  ...props
}: {
  as?: As;
  label: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<As>, "as" | "children">) {
  const Component = (as ?? "section") as ElementType;
  return (
    <Component aria-label={label} className={className} {...props}>
      {children}
    </Component>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export function SkipLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="skip-link" href={href}>
      {children}
    </a>
  );
}
