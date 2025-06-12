"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, ListChecks, Target, Sparkles, Settings, LogOut, UserCircle2, Menu, Wallet, Repeat, Calendar } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
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
  useSidebar,
} from '@/components/ui/sidebar';
import { AppLogo } from '@/components/app-logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & insights' },
  { href: '/transactions', label: 'Transactions', icon: ListChecks, description: 'Manage expenses' },
  { href: '/recurring', label: 'Recurring', icon: Repeat, description: 'Automated transactions' },
  { href: '/bills', label: 'Bills Calendar', icon: Calendar, description: 'Bill tracking & alerts' },
  { href: '/budgets', label: 'Budgets', icon: Wallet, description: 'Spending limits' },
  { href: '/goals', label: 'Goals', icon: Target, description: 'Financial targets' },
  { href: '/analytics', label: 'Analytics', icon: Sparkles, description: 'Advanced insights' },
  { href: '/ai-insights', label: 'AI Advisor', icon: Sparkles, description: 'AI financial insights' },
];

// Sidebar content component that can access sidebar context
function SidebarContentComponent() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();
  const previousPathnameRef = useRef(pathname);
  const [mounted, setMounted] = useState(false);
  
  // Track when component is mounted to prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Auto-close sidebar on mobile when route actually changes (not on initial mount)
  useEffect(() => {
    if (mounted && isMobile && previousPathnameRef.current !== pathname) {
      setOpenMobile(false);
    }
    previousPathnameRef.current = pathname;
  }, [pathname, isMobile, setOpenMobile, mounted]);

  const userEmail = user?.email || "User";
  const userInitial = userEmail.charAt(0).toUpperCase();

  const handleNavClick = () => {
    // Only close on navigation click, not on mount
    if (mounted && isMobile) {
      setOpenMobile(false);
    }
  };

  // Prevent rendering during hydration mismatch
  if (!mounted) {
    return (
      <>
        <SidebarHeader className="p-4 border-b border-sidebar-border/50">
          <div className="flex items-center justify-between">
            <AppLogo />
            <div className="md:hidden">
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent className="p-3">
          <SidebarMenu className="space-y-1">
            {navItems.map((item, i) => (
              <SidebarMenuItem key={i}>
                <Skeleton className="h-12 w-full rounded-lg" />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        
        <SidebarFooter className="p-4 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3 p-2 rounded-lg">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-10 w-full mt-3 rounded-md" />
        </SidebarFooter>
      </>
    );
  }

  return (
    <>
      <SidebarHeader className="p-4 border-b border-sidebar-border/50">
        <div className="flex items-center justify-between">
          <AppLogo />
          <div className="md:hidden">
            <SidebarTrigger className="h-8 w-8 p-0">
              <Menu className="h-4 w-4" />
            </SidebarTrigger>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-3">
        <SidebarMenu className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={{ children: item.label, className: "ml-2" }}
                  className={cn(
                    "h-12 rounded-lg transition-all duration-200 group hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  )}
                >
                  <Link href={item.href} onClick={handleNavClick} className="flex items-center gap-3 p-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-sidebar-accent/50 text-sidebar-foreground/70 group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground"
                    )}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="font-medium text-sm truncate">{item.label}</span>
                      <span className="text-xs text-sidebar-foreground/60 truncate group-data-[collapsible=icon]:hidden">
                        {item.description}
                      </span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t border-sidebar-border/50 bg-sidebar-accent/20">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/30">
          <Avatar className="h-9 w-9 ring-2 ring-sidebar-border">
            {user?.photoURL ? (
              <AvatarImage src={user.photoURL} alt={userEmail} />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {userInitial || <UserCircle2 className="h-4 w-4" />}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="group-data-[collapsible=icon]:hidden flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate" title={user?.displayName || userEmail}>
              {user?.displayName || userEmail}
            </p>
            {user?.displayName && user?.email && (
              <p className="text-xs text-sidebar-foreground/70 truncate" title={userEmail}>
                {userEmail}
              </p>
            )}
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start mt-3 h-10 group-data-[collapsible=icon]:px-2 hover:bg-destructive hover:text-destructive-foreground transition-colors" 
          onClick={signOut}
        >
          <LogOut className="mr-2 group-data-[collapsible=icon]:mr-0 h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
        </Button>
      </SidebarFooter>
    </>
  );
}

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    // Enhanced loading skeleton with better styling
    return (
      <SidebarProvider defaultOpen>
        <Sidebar variant="sidebar" collapsible="icon" className="border-r border-sidebar-border/50">
          <SidebarHeader className="p-4 border-b border-sidebar-border/50">
            <Skeleton className="h-8 w-32" />
          </SidebarHeader>
          <SidebarContent className="p-3">
            <SidebarMenu className="space-y-1">
              {[...Array(4)].map((_, i) => (
                <SidebarMenuItem key={i}>
                  <Skeleton className="h-12 w-full rounded-lg" />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border/50">
            <div className="flex items-center gap-3 p-2 rounded-lg">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="group-data-[collapsible=icon]:hidden flex-1">
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-10 w-full mt-3 rounded-md" />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
            <div className="md:hidden">
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
            <div className="flex-1" />
          </header>
          <main className="flex-1 overflow-auto p-4 sm:px-6 sm:py-0">
            <div className="space-y-6">
              <Skeleton className="h-8 w-48" />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-lg" />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // If not loading and no user, AuthProvider will handle redirect
  if (!user && !loading) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon" className="border-r border-sidebar-border/50 bg-sidebar">
        <SidebarContentComponent />
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
          <div className="md:hidden">
            <SidebarTrigger className="h-8 w-8 p-0 hover:bg-muted rounded-md">
              <Menu className="h-4 w-4" />
            </SidebarTrigger>
          </div>
          <div className="flex-1" />
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:px-6 sm:py-0">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
