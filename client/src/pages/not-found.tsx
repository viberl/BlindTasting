import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Wine } from 'lucide-react';

export default function NotFound() {
  const [_, navigate] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
      <div className="max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="bg-red-50 p-4 rounded-full">
            <Wine className="h-12 w-12 text-[#4C0519]" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-4">Seite nicht gefunden</h1>
        
        <p className="text-gray-600 mb-8">
          Der Wein, den Sie suchen, ist nicht in unserem Keller. Lassen Sie uns zurückgehen und einen anderen finden.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={() => navigate('/')}
            className="bg-[#4C0519] hover:bg-[#3A0413]"
          >
            Zurück zur Startseite
          </Button>
          
          <Button 
            onClick={() => window.history.back()}
            variant="outline"
          >
            Zurück zur vorherigen Seite
          </Button>
        </div>
      </div>
    </div>
  );
}