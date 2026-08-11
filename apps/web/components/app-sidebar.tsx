"use client";

import { BookOpen, Bot, Cable, Home, MessageSquare, Users } from "lucide-react";
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
              className="flex-1 group-data-[collapsible=icon]:hidden"
              render={<Link href="/" />}
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </div>
              <span className="font-semibold">Gilly</span>
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
