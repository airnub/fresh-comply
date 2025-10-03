"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Flex, Link as ThemeLink } from "@radix-ui/themes";

type NavLink = {
  href: string;
  label: string;
};

export default function PartnerAdminNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <Flex asChild align="center" gap="3" wrap="wrap">
      <nav aria-label="Partner admin navigation">
        {links.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <ThemeLink
              key={link.href}
              asChild
              underline={active ? "always" : "never"}
              weight={active ? "bold" : "regular"}
            >
              <Link href={link.href} aria-current={active ? "page" : undefined}>
                {link.label}
              </Link>
            </ThemeLink>
          );
        })}
      </nav>
    </Flex>
  );
}
