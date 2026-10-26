"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Users, Plus, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const nav = [
  { href: "/documents", label: "My Documents", icon: FileText },
  { href: "/shared", label: "Shared with Me", icon: Users },
];

export default function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="h-8 w-8 rounded-lg bg-zinc-900 text-white grid place-items-center font-bold text-sm">P</div>
        <span className="text-lg font-semibold tracking-tight">Paperstack</span>
        <button className="ml-auto md:hidden p-1" onClick={() => setOpen(false)} aria-label="Close navigation">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="px-3">
        <Link
          href="/documents?new=1"
          onClick={() => setOpen(false)}
          className="flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" /> New Document
        </Link>
      </div>
      <nav className="mt-4 flex-1 px-3 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-zinc-200 text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 p-3">
        <div className="flex items-center gap-2 px-1 pb-2">
          <div className="h-8 w-8 rounded-full bg-zinc-300 grid place-items-center text-xs font-semibold text-zinc-700">
            {(email ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <span className="truncate text-xs text-zinc-600">{email ?? "Signed in"}</span>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-3">
        <button onClick={() => setOpen(true)} aria-label="Open navigation" className="p-1">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-semibold">Paperstack</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">{content}</aside>
        </div>
      )}
      <aside className="hidden md:flex md:w-64 md:flex-col md:shrink-0 md:border-r md:border-zinc-200 md:bg-white">
        {content}
      </aside>
    </>
  );
}
