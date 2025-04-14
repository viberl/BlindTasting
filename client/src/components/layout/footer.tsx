import { Wine } from "lucide-react";
import { useLocation } from "wouter";

export default function Footer() {
  const [location] = useLocation();

  // Don't show footer on auth page
  if (location === "/auth") {
    return null;
  }

  return (
    <footer className="bg-gray-50 border-t py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Wine className="h-5 w-5 text-[#4C0519]" />
            <span className="font-semibold text-lg text-[#4C0519]">BlindSip</span>
          </div>

          <div className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} BlindSip. Alle Rechte vorbehalten.
          </div>
        </div>

        <div className="mt-4 text-xs text-center text-gray-400">
          <p>BlindSip verwendet die Wein-Datenbank von <a href="https://vinaturel.de" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#4C0519]">vinaturel.de</a>. 
          Trinken Sie verantwortungsvoll.</p>
        </div>
      </div>
    </footer>
  );
}