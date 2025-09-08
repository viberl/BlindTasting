import { useAuth } from '@/hooks/use-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
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
import { PlusCircle, CalendarClock, Users, Globe, Lock, Wine, User, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from 'react';

interface Tasting {
  id: number;
  name: string;
  hostId: number;
  isPublic: boolean;
  password: string | null;
  createdAt: string;
  completedAt: string | null;
  status: string;
  startedAt?: string | null;
  hostName: string;
  hostCompany: string | null;
  requiresPassword: boolean;
  isInvited?: boolean;
  updatedAt?: string;
}

type TastingsResponse = Tasting[];

// Hilfsfunktion zum Gruppieren der Verkostungen
function groupTastings(tastings: Tasting[], userId?: number) {
  const result = {
    publicTastings: [] as Tasting[],
    invitedTastings: [] as Tasting[],
    myTastings: [] as Tasting[],
    totalTastings: 0
  };

  tastings.forEach(tasting => {
    const tastingWithTimestamp = {
      ...tasting,
      updatedAt: tasting.updatedAt || tasting.createdAt
    };

    // Meine Verkostungen (hosted)
    if (tasting.hostId === userId) {
      result.myTastings.push(tastingWithTimestamp);
    } 
    // Eingeladene Verkostungen
    else if (tasting.isInvited) {
      result.invitedTastings.push(tastingWithTimestamp);
    }
    // Öffentliche ODER passwortgeschützte Verkostungen
    else if (
      tasting.isPublic || 
      (typeof tasting.password === "string" && tasting.password.length > 0)
    ) {
      result.publicTastings.push(tastingWithTimestamp);
    }
  });

  // Sortierung nach Aktualität
  const sortByDate = (a: Tasting, b: Tasting) => 
    new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();

  result.publicTastings.sort(sortByDate);
  result.invitedTastings.sort(sortByDate);
  result.myTastings.sort(sortByDate);

  result.totalTastings = tastings.length;
  return result;
}

const PasswordBadge = ({ isProtected }: { isProtected: boolean }) => (
  <div className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 ml-2">
    <Lock className="h-3 w-3 mr-1" />
    Passwortgeschützt
  </div>
);

export default function HomePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tastings = [], isLoading, error } = useQuery<Tasting[]>({
    queryKey: ['tastings'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/tastings');
        if (!response.ok) {
          throw new Error('Fehler beim Laden der Verkostungen');
        }
        const data = await response.json();
        
        // Zusammenführen und Kennzeichnen eingeladener Tastings
        const hostedTastings = data.hosted || [];
        const participating = data.participating || [];
        const available = (data.available || []).filter((t: any) => t.status !== 'draft');
        const invited = (data.invited || []).map((t: any) => ({ ...t, isInvited: true }));

        // Deduplizieren nach ID und priorisieren invited/participating
        const combined = [...hostedTastings, ...participating, ...available, ...invited];
        const map: Record<number, any> = {};
        for (const t of combined) {
          const existing = map[t.id];
          if (!existing) {
            map[t.id] = t;
          } else {
            // Bewahre das Invited-Flag, wenn es irgendwo gesetzt ist
            map[t.id] = {
              ...existing,
              ...t,
              isInvited: Boolean(existing?.isInvited || t?.isInvited),
            };
          }
        }
        return Object.values(map);
      } catch (err) {
        console.error('Fehler beim Laden der Verkostungen:', err);
        throw err;
      }
    },
    enabled: !!user,
  });

  // Debug log the tastings data
  console.log('All tastings with host info:', tastings);
  
  // Fallback: Host-Info Map nachladen, falls leer
  const [hostInfoMap, setHostInfoMap] = useState<Record<number, { hostName: string; hostCompany: string | null }>>({});
  useEffect(() => {
    (async () => {
      const missing = (tastings || []).filter(t => !t.hostName || String(t.hostName).trim().length === 0);
      for (const t of missing) {
        if (hostInfoMap[t.id]) continue;
        try {
          const res = await apiRequest('GET', `/api/tastings/${t.id}`);
          if (res.ok) {
            const data = await res.json();
            setHostInfoMap(prev => ({ ...prev, [t.id]: { hostName: data.hostName || '', hostCompany: data.hostCompany || null } }));
          }
        } catch {}
      }
    })();
  }, [tastings]);

  // Gruppiere Tastings via Hilfsfunktion
  const { publicTastings, invitedTastings, myTastings, totalTastings } = groupTastings(tastings, user?.id);

  // Debug log the grouped tastings
  console.log('Grouped tastings:', { 
    publicTastings, 
    invitedTastings, 
    myTastings,
    totalTastings
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#274E37]"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                Fehler beim Laden der Verkostungen. Bitte versuchen Sie es später erneut.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Erweiterte Tasting-Schnittstelle mit optionalen Eigenschaften
  interface EnhancedTasting extends Tasting {
    updatedAt?: string;
  }

  const handleJoinTasting = async (tasting: Tasting) => {
    try {
      let payload: any = {};
      if (tasting.requiresPassword) {
        const password = prompt('Bitte Passwort eingeben:');
        if (!password) return;
        payload.password = password;
      }
      const res = await apiRequest('POST', `/api/tastings/${tasting.id}/join`, payload);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || 'Beitritt fehlgeschlagen');
      }
      navigate(`/taster/waiting/${tasting.id}`);
    } catch (error) {
      console.error('Fehler beim Beitreten:', error);
      alert((error as Error).message || 'Verbindungsfehler');
    }
  };

  const renderTastingCard = (tasting: EnhancedTasting, type: 'public' | 'myTastings' | 'invited', index: number) => {
    if (!tasting || !tasting.id) return null;
    
    // Erstelle einen eindeutigen Schlüssel basierend auf der ID und dem Index
    const uniqueKey = `tasting-${tasting.id}-${type}-${index}`;
    
    // Definiere den Status-Text und die zugehörigen Klassen
    const statusText = tasting.status || 'Unbekannt';
    const statusConfig = {
      draft: { text: 'Entwurf', class: 'bg-yellow-100 text-yellow-800' },
      scheduled: { text: 'Geplant', class: 'bg-blue-100 text-blue-800' },
      active: { text: 'Aktiv', class: 'bg-green-100 text-green-800' },
      completed: { text: 'Abgeschlossen', class: 'bg-gray-100 text-gray-800' },
    }[tasting.status?.toLowerCase() || 'draft'] || { text: statusText, class: 'bg-gray-100 text-gray-800' };
    
    // Bestimme das Icon basierend auf der Verkostungsart
    const tastingIcon = tasting.password ? (
      <Lock className="h-4 w-4 text-gray-500" />
    ) : (
      <Wine className="h-4 w-4 text-[#274E37]" />
    );

    // Bestimme die Aktion basierend auf dem Typ
    const actionText = type === 'myTastings' ? 'Verwalten' : type === 'invited' ? 'Beitreten' : 'An Verkostung teilnehmen';
    const isUpcoming = tasting.status?.toLowerCase() === 'scheduled';
    const isCompleted = tasting.status?.toLowerCase() === 'completed';

    // Formatiere das Datum
    const formattedDate = tasting.createdAt 
      ? format(new Date(tasting.createdAt), 'PPP', { locale: de })
      : 'Datum unbekannt';

    const displayHost = (tasting.hostName && tasting.hostName.trim().length > 0)
      ? `${tasting.hostName}${tasting.hostCompany ? ` (${tasting.hostCompany})` : ''}`
      : (hostInfoMap[tasting.id]?.hostName && hostInfoMap[tasting.id].hostName.trim().length > 0)
        ? `${hostInfoMap[tasting.id].hostName}${hostInfoMap[tasting.id].hostCompany ? ` (${hostInfoMap[tasting.id].hostCompany})` : ''}`
        : `Unbekannter Benutzer (ID: ${tasting.hostId})`;

    return (
      <div key={uniqueKey} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white relative">
        {type === 'myTastings' && (
          <button 
            onClick={async (e) => {
              e.stopPropagation();
              if (confirm('Verkostung wirklich löschen?')) {
                try {
                  await apiRequest('DELETE', `/api/tastings/${tasting.id}`);
                  queryClient.invalidateQueries({ queryKey: ['tastings'] });
                } catch (error) {
                  toast({ title: 'Fehler', description: 'Löschen fehlgeschlagen' });
                }
              }
            }}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        )}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{tasting.name}</h3>
              <span 
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.class}`}
                title={`Status: ${statusConfig.text}`}
              >
                {statusConfig.text}
              </span>
              {tasting.password && (
                <PasswordBadge isProtected={!!tasting.password} />
              )}
            </div>
            
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              <div className="flex items-center">
                <User className="mr-1.5 h-4 w-4 text-gray-400" />
                <span>Veranstalter: {displayHost}</span>
              </div>
              
              <div className="flex items-center">
                <CalendarClock className="mr-1.5 h-4 w-4 text-gray-400" />
                <span>
                  {isUpcoming ? 'Geplant für ' : isCompleted ? 'Abgeschlossen am ' : 'Erstellt am '}
                  {formattedDate}
                </span>
              </div>
              
              {tasting.updatedAt && (
                <div className="flex items-center">
                  <span className="text-xs text-gray-400">
                    Aktualisiert: {
                      tasting.updatedAt 
                        ? formatDistanceToNow(new Date(tasting.updatedAt), { 
                            addSuffix: true, 
                            locale: de 
                          }) 
                        : 'Unbekannt'
                    }
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-shrink-0">
            <Button 
              onClick={() => type === 'myTastings' 
                ? navigate(`/host/tasting/${tasting.id}`)
                : handleJoinTasting(tasting)}
              className="bg-vinaturel-original hover:bg-vinaturel-highlight text-white transition-colors whitespace-nowrap"
              disabled={isCompleted}
            >
              {actionText}
              {isCompleted && ' (Abgeschlossen)'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl bg-vinaturel-light min-h-screen">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-vinaturel-original">
            Prost, <span className="text-vinaturel-highlight">{user?.name || 'Weinliebhaber'}</span>!
          </h1>
          <p className="text-muted-foreground mt-1">Erstellen oder nehmen Sie an Weintastings teil</p>
        </div>
        <Button 
          onClick={() => navigate('/host/create-tasting')}
          className="bg-vinaturel-original hover:bg-vinaturel-highlight text-white transition-colors flex items-center gap-2"
          size="lg"
        >
          <PlusCircle className="h-5 w-5" />
          <span>Neues Tasting</span>
        </Button>
      </div>

      <Tabs defaultValue="public" className="space-y-6">
        <div className="max-w-md mx-auto md:mx-0 rounded-2xl p-[1px] bg-[#e65b2d]">
          <div className="rounded-2xl bg-vinaturel-light">
            <TabsList className="!grid w-full grid-cols-3 min-h-[60px] pb-3 rounded-2xl overflow-visible outline-none bg-transparent" style={{ minHeight: '42px', paddingBottom: '8px' }}>
              <TabsTrigger 
                value="public" 
                key="public-tab"
                className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
              >
                <Globe className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Öffentliche</span>
                {publicTastings.length > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 py-0.5 rounded-full bg-vinaturel-original text-white text-xs font-medium">
                    {publicTastings.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="invited" 
                key="invited-tab"
                className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
              >
                <User className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Eingeladen</span>
                {invitedTastings.length > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 py-0.5 rounded-full bg-vinaturel-original text-white text-xs font-medium">
                    {invitedTastings.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="myTastings" 
                key="my-tastings-tab"
                className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
              >
                <Wine className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Meine</span>
                {myTastings.length > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 py-0.5 rounded-full bg-vinaturel-original text-white text-xs font-medium">
                    {myTastings.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="public" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Öffentliche Verkostungen</h2>
            {publicTastings.length > 0 && (
              <p className="text-sm text-gray-500">
                {publicTastings.length} Verkostung{publicTastings.length !== 1 ? 'en' : ''} gefunden
              </p>
            )}
          </div>
          
          {publicTastings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {publicTastings.map((tasting, index) => renderTastingCard(tasting, 'public', index))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              <div className="mx-auto h-16 w-16 text-gray-300 mb-4">
                <Globe className="h-full w-full" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Keine öffentlichen Verkostungen</h3>
              <p className="mt-2 text-sm text-gray-500">
                Aktuell gibt es keine öffentlichen Verkostungen.
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="invited" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Eingeladene Verkostungen</h2>
            {invitedTastings.length > 0 && (
              <p className="text-sm text-gray-500">
                {invitedTastings.length} Verkostung{invitedTastings.length !== 1 ? 'en' : ''} gefunden
              </p>
            )}
          </div>
          
          {invitedTastings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {invitedTastings.map((tasting, index) => renderTastingCard(tasting, 'invited', index))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              <div className="mx-auto h-16 w-16 text-gray-300 mb-4">
                <Users className="h-full w-full" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Keine Einladungen vorhanden</h3>
              <p className="mt-2 text-sm text-gray-500">
                Sie wurden noch zu keiner Verkostung eingeladen.
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Sobald Sie eingeladen werden, erscheinen die Verkostungen hier.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="myTastings" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Meine Verkostungen</h2>
            {myTastings.length > 0 && (
              <p className="text-sm text-gray-500">
                {myTastings.length} Verkostung{myTastings.length !== 1 ? 'en' : ''} gefunden
              </p>
            )}
          </div>
          
          {myTastings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {myTastings.map((tasting, index) => renderTastingCard(tasting, 'myTastings', index))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              <div className="mx-auto h-16 w-16 text-gray-300 mb-4">
                <Wine className="h-full w-full" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Noch keine eigenen Verkostungen</h3>
              <p className="mt-2 text-sm text-gray-500">Erstellen Sie Ihre erste Verkostung und laden Sie Teilnehmer ein</p>
              <div className="mt-6">
                <Button 
                  onClick={() => navigate('/host/create-tasting')}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Verkostung erstellen
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
