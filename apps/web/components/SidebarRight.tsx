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
  const { state, setOpen, openMobile, isMobile, closeMobileSidebar } =
    useSidebar();
  const isOpen = isMobile ? openMobile.includes(name) : state.includes(name);

  const handleClose = useCallback(() => {
    if (isMobile) {
      closeMobileSidebar(name);
    } else {
      setOpen((prev) => prev.filter((n) => n !== name));
    }
  }, [isMobile, name, setOpen, closeMobileSidebar]);

  // Auto-close the chat panel when navigating to a new page so it doesn't
  // persist across unrelated routes (including when remounting after
  // visiting a route that does not render this sidebar).
  const pathname = usePathname();
  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;
  const previousPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      if (previousPathnameRef.current !== null) handleCloseRef.current();
      previousPathnameRef.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    return () => {
      handleCloseRef.current();
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
        <Chat open={isOpen} onClose={handleClose} />
      </div>
    </div>
  );
}
