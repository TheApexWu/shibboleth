"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [["/", "Catalog"], ["/tower", "Tower"], ["/inspect", "Inspect"]] as const;

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
