"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { Chat } from "@/components/assistant-chat/chat";
import { cn } from "@/utils";

export function SidebarRight({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const { state, openMobile, isMobile, setOpen, setOpenMobile } = useSidebar();
  const isOpen = isMobile ? openMobile.includes(name) : state.includes(name);
  const pathname = usePathname();

  const close = useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => prev.filter((n) => n !== name));
    } else {
      setOpen((prev) => prev.filter((n) => n !== name));
    }
  }, [isMobile, name, setOpen, setOpenMobile]);

  const closeRef = useRef(close);
  closeRef.current = close;

  // Close on route change so the panel doesn't persist across pages.
  const previousPathnameRef = useRef(pathname);
  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      closeRef.current();
    }
  }, [pathname]);

  useEffect(() => {
    return () => {
      closeRef.current();
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed right-0 top-0 z-50 h-screen border-l bg-background transition-transform duration-200 ease-linear",
        "w-full lg:w-[450px]",
        isOpen ? "translate-x-0" : "translate-x-full",
        className,
      )}
    >
      <div className="flex h-full w-full flex-col overflow-hidden">
        <Chat open={isOpen} onClose={close} />
      </div>
    </div>
  );
}
