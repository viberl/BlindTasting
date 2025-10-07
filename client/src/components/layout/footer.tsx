export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <img
              src="/BlindSip_glass_only_cleaned.png"
              alt="BlindSip Logo"
              className="h-6 w-6 object-contain"
            />
            <span className="font-semibold text-lg text-[#274E37]">BlindSip</span>
          </div>

          <div className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} BlindSip. Alle Rechte vorbehalten.
          </div>
        </div>

        <div className="mt-4 text-xs text-center text-gray-400">
          <p>BlindSip verwendet die Wein-Datenbank von <a href="https://vinaturel.de" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#274E37]">vinaturel.de</a>. 
          Trinken Sie verantwortungsvoll.</p>
        </div>
      </div>
    </footer>
  );
}
