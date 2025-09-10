import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';

type Tasting = {
  id: number;
  name: string;
  hostId: number;
  status: string;
  createdAt: string;
  hostName?: string;
  hostCompany?: string | null;
};

export default function MyTastingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ hosted: Tasting[]; participating: Tasting[] }>({
    queryKey: ['/api/tastings','mine'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/tastings');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const json = await res.json();
      return { hosted: json.hosted || [], participating: json.participating || [] };
    },
    enabled: !!user,
  });

  if (isLoading) return <div className="container mx-auto p-6">Lade…</div>;

  const hostedCompleted = (data?.hosted || []).filter(t => (t.status || '').toLowerCase() === 'completed');
  const participatedCompleted = (data?.participating || []).filter(t => (t.status || '').toLowerCase() === 'completed');

  const renderCard = (t: Tasting, isHost: boolean) => (
    <Card key={t.id} className="border border-gray-100 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">{t.name}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-gray-600">
        {(isHost ? 'Veranstaltet' : 'Veranstalter')}{!isHost && t.hostName ? `: ${t.hostName}` : ''}
      </CardContent>
      <CardFooter>
        <Button
          className="bg-[#274E37] hover:bg-[#1E3E2B]"
          onClick={() => {
            if (isHost) navigate(`/host/dashboard/${t.id}`);
            else navigate(`/tasting/${t.id}/results`);
          }}
        >
          Ergebnis
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <h1 className="text-2xl font-bold mb-4">Meine Verkostungen</h1>
      <Tabs defaultValue="participated">
        <TabsList className="mb-4">
          <TabsTrigger value="participated">Teilgenommen</TabsTrigger>
          <TabsTrigger value="hosted">Veranstaltet</TabsTrigger>
        </TabsList>
        <TabsContent value="participated">
          <div className="grid gap-4 sm:grid-cols-2">
            {participatedCompleted.length > 0 ? participatedCompleted.map(t => renderCard(t, false)) : (
              <div className="text-gray-500">Keine abgeschlossenen Verkostungen</div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="hosted">
          <div className="grid gap-4 sm:grid-cols-2">
            {hostedCompleted.length > 0 ? hostedCompleted.map(t => renderCard(t, true)) : (
              <div className="text-gray-500">Keine abgeschlossenen Verkostungen</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
