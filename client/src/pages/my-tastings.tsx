import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { Lock, CalendarClock, User, Wine } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type Tasting = {
  id: number;
  name: string;
  hostId: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string | null;
  password?: string | null;
  hostName?: string;
  hostCompany?: string | null;
};

const PasswordBadge = ({ isProtected }: { isProtected: boolean }) => (
  <div className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 ml-2">
    <Lock className="h-3 w-3 mr-1" />
    Passwortgeschützt
  </div>
);

export default function MyTastingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ hosted: Tasting[]; participating: Tasting[]; invited?: Tasting[] }>({
    queryKey: ['/api/tastings','mine'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/tastings');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const json = await res.json();
      return { hosted: json.hosted || [], participating: json.participating || [], invited: json.invited || [] };
    },
    enabled: !!user,
  });

  if (isLoading) return <div className="container mx-auto p-6">Lade…</div>;

  // Zeige im Tab "Teilgenommen" alle Tastings, an denen der User teilgenommen hat – unabhängig vom Status
  const hostedCompleted = (data?.hosted || []).filter(t => (t.status || '').toLowerCase() === 'completed');
  // Fallback: falls participating serverseitig leer ist, ergänze eingeladene Tastings
  const participatedAllRaw = [
    ...(data?.participating || []),
    ...(data?.invited || []),
  ];
  const participatedAll = Array.from(new Map(participatedAllRaw.map(t => [t.id, t])).values());

  const renderCard = (t: Tasting, isHost: boolean) => {
    const statusKey = (t.status || '').toLowerCase();
    const statusConfig = {
      draft: { text: 'Entwurf', class: 'bg-yellow-100 text-yellow-800' },
      scheduled: { text: 'Geplant', class: 'bg-blue-100 text-blue-800' },
      active: { text: 'Aktiv', class: 'bg-green-100 text-green-800' },
      started: { text: 'Gestartet', class: 'bg-green-100 text-green-800' },
      completed: { text: 'Abgeschlossen', class: 'bg-gray-200 text-gray-800' },
    }[statusKey] || { text: t.status || 'Unbekannt', class: 'bg-gray-100 text-gray-800' };

    const tastingDate = t.completedAt || t.updatedAt || t.createdAt;
    const formattedDate = tastingDate ? format(new Date(tastingDate), 'PPP', { locale: de }) : 'Noch nicht festgelegt';
    const hostDisplay = isHost
      ? `${user?.name || 'Ich'}${user?.company ? ` (${user.company})` : ''}`
      : t.hostName
        ? `${t.hostName}${t.hostCompany ? ` (${t.hostCompany})` : ''}`
        : 'Unbekannter Veranstalter';

    return (
      <div key={t.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{t.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.class}`}>{statusConfig.text}</span>
              {t.password && <PasswordBadge isProtected />}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              <div className="flex items-center">
                <User className="mr-1.5 h-4 w-4 text-gray-400" />
                <span>{isHost ? 'Veranstaltet von: ' : 'Veranstalter: '}{hostDisplay}</span>
              </div>
              <div className="flex items-center">
                <CalendarClock className="mr-1.5 h-4 w-4 text-gray-400" />
                <span>Verkostet am {formattedDate}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Wine className="h-4 w-4 text-[#274E37]" />
              <span>{isHost ? 'Eigene Verkostung' : 'Teilgenommen'}</span>
            </div>
            <Button
              onClick={() => {
                if (isHost) navigate(`/host/tasting/${t.id}`);
                else navigate(`/tasting/${t.id}/results`);
              }}
              className="bg-vinaturel-original hover:bg-vinaturel-highlight text-white"
            >
              {isHost ? 'Verwaltung öffnen' : 'Ergebnisse ansehen'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <h1 className="text-2xl font-bold mb-4">Meine Verkostungen</h1>
      <Tabs defaultValue="participated" className="space-y-6">
        <div className="max-w-md mx-auto md:mx-0 rounded-2xl p-[1px] bg-[#e65b2d]">
          <div className="rounded-2xl bg-vinaturel-light">
            <TabsList className="!grid w-full grid-cols-2 min-h-[60px] pb-3 rounded-2xl overflow-visible outline-none bg-transparent" style={{ minHeight: '42px', paddingBottom: '8px' }}>
              <TabsTrigger
                value="participated"
                className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
              >
                <User className="h-4 w-4" />
                <span className="truncate">Teilgenommen</span>
                {participatedAll.length > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 py-0.5 rounded-full bg-vinaturel-original text-white text-xs font-medium">
                    {participatedAll.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="hosted"
                className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
              >
                <Wine className="h-4 w-4" />
                <span className="truncate">Veranstaltet</span>
                {hostedCompleted.length > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 py-0.5 rounded-full bg-vinaturel-original text-white text-xs font-medium">
                    {hostedCompleted.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        <TabsContent value="participated">
          <div className="grid gap-4 sm:grid-cols-2">
            {participatedAll.length > 0 ? participatedAll.map(t => renderCard(t, false)) : (
              <div className="text-gray-500">Keine Verkostungen gefunden</div>
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
