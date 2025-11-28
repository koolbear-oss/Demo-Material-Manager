
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  History, 
  LogOut, 
  Menu, 
  X,
  Bell,
  Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger, 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function Layout({ children }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [teamMember, setTeamMember] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        // Fetch associated team member info if exists
        if (currentUser?.email) {
          const members = await base44.entities.TeamMember.list({
             filter: { email: currentUser.email },
             limit: 1
          });
          if (members.length > 0) {
            setTeamMember(members[0]);
          }
        }
      } catch (e) {
        console.error("Auth error", e);
      }
    };
    fetchUser();
  }, []);

  const isAdmin = teamMember?.role === 'admin' || user?.role === 'admin' || !teamMember; // Default to admin if setup not complete

  const navigation = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard, show: true },
        { name: 'Inventory', href: '/Inventory', icon: Package, show: true },
        { name: 'Demo Cases', href: '/DemoCases', icon: Package, show: true },
        { name: 'Team', href: '/Team', icon: Users, show: isAdmin },
        { name: 'Activity Log', href: '/ActivityLog', icon: History, show: isAdmin },
      ];

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 fixed w-full z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = '/'}>
                <div className="bg-blue-700 text-white p-1.5 rounded font-bold text-lg">AA</div>
                <span className="hidden md:block font-semibold text-lg tracking-tight text-gray-900">ASSA ABLOY <span className="font-normal text-gray-500">Demo Tracker</span></span>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex md:items-center md:space-x-8">
              {navigation.map((item) => (
                item.show && (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
                      isActive(item.href)
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Link>
                )
              ))}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <div className="relative">
                 {/* Placeholder for search or notifications */}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.photo_url} alt={user?.first_name} />
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {user?.first_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.first_name} {user?.last_name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => base44.auth.logout()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <Button variant="ghost" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 absolute w-full shadow-lg">
            <div className="pt-2 pb-3 space-y-1">
              {navigation.map((item) => (
                item.show && (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                      isActive(item.href)
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </div>
                  </Link>
                )
              ))}
              <div className="border-t border-gray-200 mt-4 pt-4 pb-3 pl-3">
                 <div className="flex items-center px-4" onClick={() => base44.auth.logout()}>
                    <LogOut className="h-5 w-5 mr-3 text-gray-500" />
                    <span className="text-gray-500 font-medium">Log out</span>
                 </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="pt-20 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
