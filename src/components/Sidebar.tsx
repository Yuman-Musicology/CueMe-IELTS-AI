"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookMarked, BookOpen, Mic } from "lucide-react";

const navItems = [
  {
    href: "/forge",
    label: "语料库",
    icon: BookOpen,
  },
  {
    href: "/interview",
    label: "实战练习",
    icon: Mic,
  },
  {
    href: "/deck",
    label: "我的卡组 (My Deck)",
    icon: BookMarked,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="fixed left-6 top-1/2 z-50 -translate-y-1/2">
      <nav className="flex w-[72px] flex-col items-center gap-6 rounded-full border border-white/20 bg-white/30 py-8 shadow-xl backdrop-blur-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(event) => {
                if (pathname === item.href) return;

                event.preventDefault();
                router.push(item.href);
                requestAnimationFrame(() => {
                  router.refresh();
                });
              }}
              title={item.label}
              aria-label={item.label}
              className={[
                "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                isActive
                  ? "bg-[#1C1C1E] text-[#FACC15] shadow-md"
                  : "text-gray-400 hover:text-gray-800",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
