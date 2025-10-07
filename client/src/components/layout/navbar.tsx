import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wine, User, LogOut, ChevronDown, Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Don't show navbar on auth page
  if (location === "/auth") {
    return null;
  }

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="container mx-auto p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img
            src="/BlindSip_glass_only_cleaned.png"
            alt="BlindSip Logo"
            className="h-8 w-8 object-contain"
          />
          <button
            onClick={() => navigate("/")}
            className="text-xl font-bold text-[#274E37]"
          >
            BlindSip
          </button>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 border-gray-200 text-[#274E37] hover:text-[#274E37] hover:bg-[#274E37]/10 focus:text-[#274E37] focus:bg-[#274E37]/10"
                >
                  <Avatar className="h-8 w-8 border border-gray-200">
                    <AvatarImage src={user.profileImage} alt={user.name} />
                    <AvatarFallback>
                      {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline">{user.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Mein Konto</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-[#274E37] focus:bg-[#274E37]/10 focus:text-[#274E37]"
                  onClick={() => navigate("/my-tastings")}
                >
                  <Wine className="mr-2 h-4 w-4" />
                  <span>Meine Verkostungen</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-[#274E37] focus:bg-[#274E37]/10 focus:text-[#274E37]"
                  onClick={() => navigate("/my-wines")}
                >
                  <Heart className="mr-2 h-4 w-4" />
                  <span>Verkostete Weine</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-[#274E37] focus:bg-[#274E37]/10 focus:text-[#274E37]"
                  onClick={() => navigate("/profile")}
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Mein Profil</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-[#e65b2d] focus:bg-[#e65b2d]/10 focus:text-[#e65b2d]"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Abmelden</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => navigate("/auth")}
              className="bg-[#274E37] hover:bg-[#1E3E2B]"
            >
              Anmelden
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
