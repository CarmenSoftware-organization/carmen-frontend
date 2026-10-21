import type React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { SideMain } from "./side-main";
import { Link } from "react-router";
import { CarmenLogo } from "../icons/carmen-logo";
import brandingLightUrl from "../icons/carmen-branding-light.svg";
import brandingDarkUrl from "../icons/carmen-branding-dark.svg";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:px-0">
        <Link
          to="/"
          className="flex cursor-pointer items-center gap-2 group-data-[collapsible=icon]:justify-center"
        >
          <span className="group-data-[collapsible=icon]:hidden">
            <img
              src={brandingLightUrl}
              alt="Carmen Blue"
              className="h-11 w-auto dark:hidden"
            />
            <img
              src={brandingDarkUrl}
              alt="Carmen Blue"
              className="hidden h-11 w-auto dark:block"
            />
          </span>
          <span className="hidden group-data-[collapsible=icon]:block">
            <CarmenLogo size={32} />
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SideMain />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
