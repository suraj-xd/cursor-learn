"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeft, PanelRight, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_WIDTH_LEFT = "16rem";
const SIDEBAR_WIDTH_LEFT_COLLAPSED = "3rem";
const SIDEBAR_WIDTH_RIGHT = "420px";

const sidebarVariants = cva(
  "flex flex-col h-full bg-sidebar text-sidebar-foreground border-sidebar-border",
  {
    variants: {
      side: {
        left: "border-r",
        right: "border-l",
      },
      collapsed: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      side: "left",
      collapsed: false,
    },
  }
);

interface SidebarContextValue {
  open: boolean;
  collapsed: boolean;
  setOpen: (open: boolean) => void;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
  side: "left" | "right";
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebarContext() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
}

interface SidebarProviderProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  side?: "left" | "right";
}

export function SidebarProvider({
  children,
  open = true,
  onOpenChange,
  collapsed = false,
  onCollapsedChange,
  side = "left",
}: SidebarProviderProps) {
  const [internalOpen, setInternalOpen] = React.useState(open);
  const [internalCollapsed, setInternalCollapsed] = React.useState(collapsed);

  const isOpen = onOpenChange ? open : internalOpen;
  const isCollapsed = onCollapsedChange ? collapsed : internalCollapsed;

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (onOpenChange) {
        onOpenChange(value);
      } else {
        setInternalOpen(value);
      }
    },
    [onOpenChange]
  );

  const setCollapsed = React.useCallback(
    (value: boolean) => {
      if (onCollapsedChange) {
        onCollapsedChange(value);
      } else {
        setInternalCollapsed(value);
      }
    },
    [onCollapsedChange]
  );

  const toggle = React.useCallback(() => {
    setOpen(!isOpen);
  }, [isOpen, setOpen]);

  return (
    <SidebarContext.Provider
      value={{
        open: isOpen,
        collapsed: isCollapsed,
        setOpen,
        setCollapsed,
        toggle,
        side,
      }}
    >
      <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
    </SidebarContext.Provider>
  );
}

interface SidebarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sidebarVariants> {
  open?: boolean;
  width?: string;
}

export function Sidebar({
  className,
  side = "left",
  collapsed = false,
  open = true,
  width,
  children,
  ...props
}: SidebarProps & { open?: boolean; width?: string }) {
  const getWidth = () => {
    if (width) return width;
    if (side === "right") return SIDEBAR_WIDTH_RIGHT;
    return collapsed ? SIDEBAR_WIDTH_LEFT_COLLAPSED : SIDEBAR_WIDTH_LEFT;
  };

  const currentWidth = getWidth();

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.aside
          data-sidebar={side}
          data-collapsed={collapsed}
          initial={{
            x: side === "left" ? "-100%" : "100%",
            opacity: 0,
          }}
          animate={{
            x: 0,
            opacity: 1,
            width: currentWidth,
            minWidth: currentWidth,
          }}
          // exit={{
          //   x: side === "left" ? "-100%" : "100%",
          //   opacity: 0,
          // }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
          className={cn(sidebarVariants({ side, collapsed }), className)}
          {...props}
        >
          <motion.div
            className="flex flex-col h-full"
            initial={false}
            animate={{ opacity: collapsed ? 0.9 : 1 }}
            transition={{ duration: 0.15 }}
          >
            {children}
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SidebarHeader({ className, ...props }: SidebarHeaderProps) {
  return (
    <div
      data-sidebar="header"
      className={cn(
        "flex items-center justify-between px-3 py-2 border-b border-sidebar-border",
        className
      )}
      {...props}
    />
  );
}

interface SidebarContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SidebarContent({ className, ...props }: SidebarContentProps) {
  return (
    <div
      data-sidebar="content"
      className={cn("flex-1 overflow-y-auto overflow-x-hidden p-2", className)}
      {...props}
    />
  );
}

interface SidebarFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SidebarFooter({ className, ...props }: SidebarFooterProps) {
  return (
    <div
      data-sidebar="footer"
      className={cn("px-3 py-2 border-t border-sidebar-border", className)}
      {...props}
    />
  );
}

interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SidebarGroup({ className, ...props }: SidebarGroupProps) {
  return (
    <div
      data-sidebar="group"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  );
}

interface SidebarGroupLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed?: boolean;
}

export function SidebarGroupLabel({
  className,
  collapsed,
  children,
  ...props
}: SidebarGroupLabelProps) {
  if (collapsed) return null;

  return (
    <div
      data-sidebar="group-label"
      className={cn(
        "px-2 py-1.5 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface SidebarMenuProps extends React.HTMLAttributes<HTMLUListElement> {}

export function SidebarMenu({ className, ...props }: SidebarMenuProps) {
  return (
    <ul
      data-sidebar="menu"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  );
}

interface SidebarMenuItemProps extends React.HTMLAttributes<HTMLLIElement> {}

export function SidebarMenuItem({ className, ...props }: SidebarMenuItemProps) {
  return (
    <li
      data-sidebar="menu-item"
      className={cn("list-none", className)}
      {...props}
    />
  );
}

interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
  collapsed?: boolean;
  tooltip?: string;
}

export function SidebarMenuButton({
  className,
  isActive,
  collapsed,
  tooltip,
  children,
  ...props
}: SidebarMenuButtonProps) {
  const button = (
    <button
      data-sidebar="menu-button"
      data-active={isActive}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
        "hover:bg-sidebar-accent/10 hover:text-sidebar-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
        isActive &&
          "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
        collapsed && "justify-center px-2",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );

  if (collapsed && tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="whitespace-pre-line">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

interface SidebarTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  side?: "left" | "right";
}

export function SidebarTrigger({
  className,
  side = "left",
  ...props
}: SidebarTriggerProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", className)}
      {...props}
    >
      {side === "left" ? (
        <PanelLeft className="h-4 w-4" />
      ) : (
        <PanelRight className="h-4 w-4" />
      )}
      <span className="sr-only">Toggle {side} sidebar</span>
    </Button>
  );
}

interface SidebarCloseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function SidebarClose({ className, ...props }: SidebarCloseProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6", className)}
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close sidebar</span>
    </Button>
  );
}

interface SidebarInsetProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SidebarInset({ className, ...props }: SidebarInsetProps) {
  return (
    <main
      data-sidebar="inset"
      className={cn("flex-1 overflow-hidden", className)}
      {...props}
    />
  );
}
