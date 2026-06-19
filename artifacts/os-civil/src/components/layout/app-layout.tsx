import { Link, useLocation } from "wouter";
import { LayoutDashboard, ClipboardList, PlusCircle, Users, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Painel de Controle", icon: LayoutDashboard },
    { href: "/ordens", label: "Ordens de Serviço", icon: ClipboardList },
    { href: "/ordens/nova", label: "Nova OS", icon: PlusCircle },
    { href: "/tecnicos", label: "Equipe Técnica", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row text-foreground dark">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
          <HardHat className="w-6 h-6 text-primary mr-3" />
          <span className="font-bold text-lg tracking-tight uppercase">OS Civil</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}>
                <item.icon className={cn("w-5 h-5 mr-3", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
