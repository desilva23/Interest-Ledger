"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/payees", label: "Payees" },
  { href: "/loans", label: "Loans" },
  { href: "/reports", label: "Reports" },
];

export default function Nav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (pathname === "/login") return null;

  return (
    <nav className="bg-cover px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-6 flex-wrap">
        <span className="font-display text-goldBg text-lg font-bold">Khata</span>
        <div className="flex gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                pathname === l.href ? "bg-paper text-ink" : "text-white/75 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      {user && (
        <div className="flex items-center gap-3 text-sm text-white/80">
          <span>{user.name}</span>
          <button onClick={logout} className="underline hover:text-white">
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}
