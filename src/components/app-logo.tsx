
import { PiggyBank } from 'lucide-react'; // Or a more "Indian" finance related icon if desired
import Link from 'next/link';

export function AppLogo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 text-sidebar-primary hover:text-sidebar-primary/90 transition-colors">
      <PiggyBank className="h-8 w-8" />
      <span className="text-xl font-semibold">KharchGini</span>
    </Link>
  );
}
