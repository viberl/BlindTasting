import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, CalendarClock, Users, Globe, Lock, Wine } from 'lucide-react';

type TastingsResponse = {
  hosted: Tasting[];
  participating: Tasting[];
  available: Tasting[];
};

interface Tasting {
  id: number;
  name: string;
  hostId: number;
  isPublic: boolean;
  status: string;
  createdAt: string;
}

export default function HomePage() {
  const { user } = useAuth();
  const [_, navigate] = useLocation();

  const { data: tastingsData, isLoading } = useQuery<TastingsResponse>({
    queryKey: ['/api/tastings'],
    enabled: !!user,
  });

  const renderTastingCard = (tasting: Tasting, type: 'hosted' | 'participating' | 'available') => {
    return (
      <Card key={tasting.id} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{tasting.name}</CardTitle>
              <CardDescription>
                Status: <span className={`font-medium ${tasting.status === 'active' ? 'text-green-600' : tasting.status === 'completed' ? 'text-blue-600' : 'text-amber-600'}`}>
                  {tasting.status.charAt(0).toUpperCase() + tasting.status.slice(1)}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center">
              {tasting.isPublic ? (
                <Globe className="h-4 w-4 text-gray-500" />
              ) : (
                <Lock className="h-4 w-4 text-gray-500" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <CalendarClock className="mr-1 h-4 w-4" />
            {new Date(tasting.createdAt).toLocaleDateString()}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => navigate(type === 'hosted' ? `/host/dashboard/${tasting.id}` : `/tasting/${tasting.id}`)}
            className="w-full bg-[#4C0519] hover:bg-[#3A0413]"
          >
            {type === 'hosted' ? 'Verwalten' : type === 'participating' ? 'Teilnehmen' : 'Beitreten'}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Willkommen, {user?.name || 'Weinliebhaber'}!</h1>
          <p className="text-muted-foreground">Erstellen oder nehmen Sie an Weintastings teil</p>
        </div>
        <Button 
          onClick={() => navigate('/host/create')}
          className="bg-[#4C0519] hover:bg-[#3A0413]"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Neues Tasting erstellen
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-[#4C0519] border-t-transparent rounded-full"></div>
        </div>
      ) : tastingsData && (
        <Tabs defaultValue="hosted">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="hosted" className="relative">
              <Users className="mr-2 h-4 w-4" />
              Gehostete Tastings
              {tastingsData.hosted.length > 0 && (
                <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#4C0519] text-xs text-white">
                  {tastingsData.hosted.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="participating" className="relative">
              <Wine className="mr-2 h-4 w-4" />
              Teilnahmen
              {tastingsData.participating.length > 0 && (
                <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#4C0519] text-xs text-white">
                  {tastingsData.participating.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="available" className="relative">
              <Globe className="mr-2 h-4 w-4" />
              Verfügbare Tastings
              {tastingsData.available.length > 0 && (
                <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#4C0519] text-xs text-white">
                  {tastingsData.available.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hosted">
            {tastingsData.hosted.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Sie hosten noch keine Tastings.</p>
                <Button 
                  onClick={() => navigate('/host/create')}
                  variant="outline"
                  className="mt-4"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Erstellen Sie Ihr erstes Tasting
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tastingsData.hosted.map(tasting => renderTastingCard(tasting, 'hosted'))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="participating">
            {tastingsData.participating.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Sie nehmen aktuell an keinen Tastings teil.</p>
                <Button 
                  onClick={() => document.querySelector('[data-value="available"]')?.dispatchEvent(new Event('click'))}
                  variant="outline"
                  className="mt-4"
                >
                  Verfügbare Tastings anzeigen
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tastingsData.participating.map(tasting => renderTastingCard(tasting, 'participating'))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="available">
            {tastingsData.available.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Es gibt derzeit keine weiteren verfügbaren Tastings.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tastingsData.available.map(tasting => renderTastingCard(tasting, 'available'))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}