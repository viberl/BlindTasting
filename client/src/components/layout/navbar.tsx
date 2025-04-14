import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Wine, Menu, LogOut, Home, UserCircle } from "lucide-react";

export default function Navbar() {
  // Use try-catch to handle cases where AuthProvider might not be ready
  let user = null;
  let logoutMutation = { mutate: () => {} };
  try {
    const auth = useAuth();
    user = auth.user;
    logoutMutation = auth.logoutMutation;
  } catch (error) {
    // If useAuth fails, we'll just render a basic navbar without user-specific features
    console.log("Auth context not available yet");
  }
  
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const isAuthPage = location === "/auth";

  if (isAuthPage) {
    return null; // Don't show navbar on auth page
  }

  const NavLinks = () => (
    <>
      <Link href="/">
        <a className={`px-3 py-2 rounded-md text-sm font-medium ${location === "/" ? "text-white bg-[#4C0519]" : "text-gray-300 hover:text-white hover:bg-[#7F1D1D]"}`}>
          Home
        </a>
      </Link>
      <Link href="/#my-tastings">
        <a className={`px-3 py-2 rounded-md text-sm font-medium ${location.includes("tasting") ? "text-white bg-[#4C0519]" : "text-gray-300 hover:text-white hover:bg-[#7F1D1D]"}`}>
          My Tastings
        </a>
      </Link>
      <Link href="/#discover">
        <a className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-[#7F1D1D]">
          Discover
        </a>
      </Link>
    </>
  );

  return (
    <nav className="bg-[#7F1D1D] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Wine className="h-8 w-8 text-yellow-600" />
              <span className="ml-2 text-xl font-display font-bold">BlindSip</span>
            </div>
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <NavLinks />
            </div>
          </div>
          <div className="flex items-center">
            {user ? (
              <div className="flex items-center">
                <div className="hidden md:block">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                        <Avatar className="h-8 w-8 border border-white/20">
                          <AvatarFallback className="bg-[#4C0519] text-white">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user.name}</p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/">
                          <a className="flex cursor-pointer items-center">
                            <Home className="mr-2 h-4 w-4" />
                            <span>Dashboard</span>
                          </a>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/profile">
                          <a className="flex cursor-pointer items-center">
                            <UserCircle className="mr-2 h-4 w-4" />
                            <span>Profile</span>
                          </a>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={handleLogout}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile menu button */}
                <div className="md:hidden flex items-center">
                  <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-white">
                        <Menu className="h-6 w-6" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right">
                      <SheetHeader>
                        <SheetTitle>BlindSip</SheetTitle>
                      </SheetHeader>
                      <div className="py-4">
                        <div className="flex items-center mb-6 pb-6 border-b">
                          <Avatar className="h-10 w-10 mr-3">
                            <AvatarFallback className="bg-[#4C0519] text-white">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-3">
                          <Link href="/">
                            <a className="flex items-center px-2 py-2 rounded-md hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>
                              <Home className="mr-3 h-5 w-5" />
                              Home
                            </a>
                          </Link>
                          <Link href="/#my-tastings">
                            <a className="flex items-center px-2 py-2 rounded-md hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>
                              <Wine className="mr-3 h-5 w-5" />
                              My Tastings
                            </a>
                          </Link>
                          <Link href="/#discover">
                            <a className="flex items-center px-2 py-2 rounded-md hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>
                              <Wine className="mr-3 h-5 w-5" />
                              Discover
                            </a>
                          </Link>
                        </div>
                        <div className="pt-6 mt-6 border-t">
                          <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => {
                              handleLogout();
                              setMobileMenuOpen(false);
                            }}
                          >
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                          </Button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            ) : (
              <div className="flex space-x-4">
                <Link href="/auth">
                  <Button variant="ghost" className="text-white">
                    Login
                  </Button>
                </Link>
                <Link href="/auth">
                  <Button className="bg-[#4C0519] hover:bg-[#3A0413]">
                    Register
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
