"use client";

import { BookOpen, Bot, Cable, Home, MessageSquare, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const NAV = [
  { title: "Home", href: "/", icon: Home },
  { title: "Agents", href: "/agents", icon: Bot },
  { title: "Skills", href: "/skills", icon: BookOpen },
  { title: "Connections", href: "/connections", icon: MessageSquare },
  { title: "Tools", href: "/connectors", icon: Cable },
  { title: "Users", href: "/users", icon: Users },
];

export function AppSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-1">
            <SidebarMenuButton
              size="lg"
              className="h-auto min-h-12 flex-1 py-2 group-data-[collapsible=icon]:hidden"
              render={<Link href="/" />}
            >
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden">
                <Image
                  src="/brand/floo-agents-owl-sitting.png"
                  alt=""
                  width={48}
                  height={48}
                  className="size-12 max-w-none object-contain"
                  loading="eager"
                />
              </div>
              <div className="min-w-0 leading-tight">
                <span className="block truncate font-semibold">Floo Agents</span>
                <span className="block whitespace-normal text-[0.6rem] text-muted-foreground">
                  Any agent. Any harness. Any channel.
                </span>
              </div>
            </SidebarMenuButton>
            <SidebarTrigger className="shrink-0" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(item.href)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
