
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Added useRouter
import { LayoutDashboard, ListChecks, Target, Sparkles, Settings, LogOut, UserCircle2 } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { AppLogo } from '@/components/app-logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/auth-context'; // Import useAuth
import { Skeleton } from '@/components/ui/skeleton'; // For loading state

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ListChecks },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/ai-insights', label: 'AI Insights', icon: Sparkles },
];

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth(); // Get user and signOut from context
  const router = useRouter();

  if (loading) {
     // More detailed skeleton for the main layout while auth is loading
    return (
      <SidebarProvider defaultOpen>
        <Sidebar variant="sidebar" collapsible="icon">
          <SidebarHeader className="p-4">
            <Skeleton className="h-8 w-32" />
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              {[...Array(4)].map((_, i) => (
                <SidebarMenuItem key={i}>
                  <Skeleton className="h-8 w-full rounded-md" />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="group-data-[collapsible=icon]:hidden">
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-8 w-full mt-2" />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col">
           <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
             <div className="md:hidden">
                <Skeleton className="h-8 w-8" />
             </div>
             <div className="flex-1" />
          </header>
          <main className="flex-1 overflow-auto p-4 sm:px-6 sm:py-0">
             <Skeleton className="h-screen w-full" />
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // If not loading and no user, AuthProvider's effect will redirect.
  // This check is an additional safeguard but might be redundant if AuthProvider is robust.
  if (!user && !loading) {
     // router.push('/auth/login'); // AuthProvider should handle this
     return null; // Render nothing while redirecting
  }

  const userEmail = user?.email || "User";
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-4">
          <div className="flex items-center justify-between">
             <AppLogo />
             <div className="md:hidden">
                <SidebarTrigger />
             </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                  tooltip={{ children: item.label, className: "ml-2"}}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                    {user?.photoURL ? (
                      <AvatarImage src={user.photoURL} alt={userEmail} />
                    ) : (
                       <AvatarFallback className="bg-primary text-primary-foreground">
                         {userInitial || <UserCircle2 />}
                       </AvatarFallback>
                    )}
                </Avatar>
                <div className="group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium text-sidebar-foreground truncate max-w-[150px]" title={user?.displayName || userEmail}>
                      {user?.displayName || userEmail}
                    </p>
                    {user?.displayName && user?.email && (
                       <p className="text-xs text-sidebar-foreground/70 truncate max-w-[150px]" title={userEmail}>{userEmail}</p>
                    )}
                </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start mt-2 group-data-[collapsible=icon]:px-2" onClick={signOut}>
                <LogOut className="mr-2 group-data-[collapsible=icon]:mr-0" />
                <span className="group-data-[collapsible=icon]:hidden">Logout</span>
            </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
            <div className="md:hidden">
              <SidebarTrigger />
            </div>
            <div className="flex-1" /> 
        </header>
        <main className="flex-1 overflow-auto p-4 sm:px-6 sm:py-0">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
