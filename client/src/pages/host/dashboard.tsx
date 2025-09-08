import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Share2, Users, Wine, ClipboardList, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FlightStatus from '@/components/tasting/flight-status';
import Leaderboard from "@/components/tasting/leaderboard";
import WineCard from "@/components/wine/wine-card";

declare module 'sonner' {
  interface ToasterProps {
    variant?: 'default' | 'destructive' | 'success';
  }
}

interface Wine {
  id: number;
  name: string;
  producer: string;
  vintage: string;
  country: string;
  region: string;
  letterCode: string;
  flightId: number;
  varietals: string[];
  vinaturelId: string | null;
  isCustom: boolean;
  imageUrl: string | null;
}

interface Flight {
  id: number;
  name: string;
  completedAt: Date | null;
  startedAt: Date | null;
  completed: boolean;
  wines: Wine[];
  tastingId: number;
  orderIndex: number;
  timeLimit: number;
}

interface Tasting {
  id: number;
  name: string;
  hostName: string;
  participants: { id: number }[];
  createdAt: Date;
  completedAt: Date | null;
  status: string;
  isPublic: boolean;
  password: string | null;
  hostId: number;
}

export default function HostDashboard() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id || '0');
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<string>("current");
  const [selectedFlightIndex, setSelectedFlightIndex] = useState(0);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  // Scoring rules werden per Query geladen
  
  // Mock user for now
  const user = { id: 1, name: 'Host User' };
  
  const { data: tasting, isLoading: tastingLoading } = useQuery({
    queryKey: ['tasting', tastingId],
    queryFn: async (): Promise<Tasting> => {
      const response = await fetch(`/api/tastings/${tastingId}`);
      if (!response.ok) throw new Error('Fehler beim Laden der Verkostung');
      const data = await response.json();
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        completedAt: data.completedAt ? new Date(data.completedAt) : null
      };
    },
    enabled: !!tastingId,
  });

  const { data: flights = [], isLoading: flightsLoading } = useQuery<Flight[]>({
    queryKey: ['flights', tastingId],
    queryFn: async (): Promise<Flight[]> => {
      const response = await fetch(`/api/tastings/${tastingId}/flights`);
      if (!response.ok) throw new Error('Fehler beim Laden der Flights');
      const data = await response.json();
      return data.map((flight: any) => ({
        ...flight,
        completedAt: flight.completedAt ? new Date(flight.completedAt) : null,
        startedAt: flight.startedAt ? new Date(flight.startedAt) : null,
        wines: flight.wines || []
      }));
    },
    enabled: !!tastingId,
  });

  useEffect(() => {
    if (flights && flights.length > 0) {
      const currentFlight = flights.find(flight => !flight.completed);
      const flightToSelect = currentFlight || flights[0];
      setSelectedFlight(flightToSelect);
      setSelectedFlightIndex(flights.findIndex(f => f.id === flightToSelect?.id));
    }
  }, [flights]);

  const { data: scoringRules } = useQuery<{ displayCount: number}>({
    queryKey: ['scoringRules', tastingId],
    queryFn: async () => {
      const response = await fetch(`/api/tastings/${tastingId}/scoring`);
      if (!response.ok) throw new Error('Fehler beim Laden der Bewertungsregeln');
      return response.json();
    },
    enabled: !!tastingId,
  });

  // Handle flight completion
  const handleFlightComplete = async (flightId: number) => {
    try {
      const response = await fetch(`/api/flights/${flightId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) throw new Error('Flight konnte nicht abgeschlossen werden');
      
      toast({
        title: "Flight abgeschlossen!",
        description: "Der Flight wurde als abgeschlossen markiert.",
      });
      
      await queryClient.invalidateQueries({ queryKey: ['flights', tastingId] });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Flight konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    }
  };

  // Copy join link to clipboard
  const copyJoinLink = () => {
    const joinLink = `${window.location.origin}/tasting/${tastingId}`;
    navigator.clipboard.writeText(joinLink);
    toast({
      title: "Beitrittslink kopiert",
      description: "Der Link wurde in die Zwischenablage kopiert.",
    });
  };

  if (tastingLoading || flightsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-vinaturel-original" />
      </div>
    );
  }

  if (!tasting) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Verkostung nicht gefunden</h2>
          <p className="mt-2">Diese Verkostung existiert nicht oder Sie haben keinen Zugriff.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>
            Zurück zum Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Check if user is the host
  if (tasting.hostId !== user?.id) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Nicht autorisiert</h2>
          <p className="mt-2">Sie sind nicht der Veranstalter dieser Verkostung.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>
            Zurück zum Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const statusBadge = () => {
    switch (tasting.status) {
      case "draft":
        return <Badge variant="outline">Entwurf</Badge>;
      case "active":
        return <Badge variant="default" className="bg-green-100 text-green-800">Aktiv</Badge>;
      case "completed":
        return <Badge variant="secondary">Abgeschlossen</Badge>;
      default:
        return null;
    }
  };

  const getCompletedFlights = (): Flight[] => 
    flights.filter(flight => flight.completedAt);
  
  const getTotalParticipants = (): number => 
    tasting?.participants?.length || 0;
  
  const getTotalWines = (): number => 
    flights.reduce((total, flight) => total + (flight.wines?.length || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-vinaturel-light to-white">
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <Card className="border border-primary/20 shadow-md overflow-hidden mb-8">
          <CardHeader className="bg-gradient-to-r from-primary to-primary/90 p-6 text-white">
            <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{tasting.name}</h1>
                <p className="text-white/90 mt-1">
                  Veranstaltet von {tasting.hostName}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                  onClick={copyJoinLink}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Beitrittslink kopieren
                </Button>
                <Button
                  className="bg-white text-primary hover:bg-white/90"
                  onClick={() => navigate(`/host/tasting/${tastingId}/edit`)}
                >
                  Verkostung bearbeiten
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
              {/* Participants Card */}
              <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-primary/10 mr-4">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Teilnehmer insgesamt</h3>
                    <p className="text-2xl font-bold text-gray-900">
                      {tasting.participants?.length || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Flights Card */}
              <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-accent/10 mr-4">
                    <ClipboardList className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Flights</h3>
                    <p className="text-2xl font-bold text-gray-900">
                      {flights?.length || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Wines Card */}
              <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-primary/10 mr-4">
                    <Wine className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Weine insgesamt</h3>
                    <p className="text-2xl font-bold text-gray-900">
                      {flights?.reduce((total, flight) => total + (flight.wines?.length || 0), 0) || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Card */}
              <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-accent/10 mr-4">
                    {statusBadge()}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Status</h3>
                    <p className="text-2xl font-bold text-gray-900">
                      {tasting.status.charAt(0).toUpperCase() + tasting.status.slice(1)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="border border-gray-100 shadow-sm overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full bg-gray-50 p-1.5 rounded-none border-b border-gray-100">
                  <TabsTrigger 
                    value="current"
                    className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                  >
                    Aktueller Flight
                  </TabsTrigger>
                  <TabsTrigger 
                    value="leaderboard"
                    className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                  >
                    Bestenliste
                  </TabsTrigger>
                  <TabsTrigger 
                    value="wines"
                    className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                  >
                    Weine
                  </TabsTrigger>
                </TabsList>

                <CardContent className="p-6">
                  <TabsContent value="current" className="space-y-6">
                    {selectedFlight && (
                      <div className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <Card className="border border-gray-100 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                              <CardTitle className="text-sm font-medium text-gray-500">
                                Teilnehmer
                              </CardTitle>
                              <Users className="h-4 w-4 text-gray-400" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              <div className="text-2xl font-bold text-gray-900">
                                {tasting?.participants?.length || 0}
                              </div>
                            </CardContent>
                          </Card>
                          <Card className="border border-gray-100 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                              <CardTitle className="text-sm font-medium text-gray-500">
                                Weine im Flight
                              </CardTitle>
                              <Wine className="h-4 w-4 text-gray-400" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              <div className="text-2xl font-bold text-gray-900">
                                {selectedFlight.wines?.length || 0}
                              </div>
                            </CardContent>
                          </Card>
                          <Card className="border border-gray-100 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                              <CardTitle className="text-sm font-medium text-gray-500">
                                Status
                              </CardTitle>
                              <ClipboardList className="h-4 w-4 text-gray-400" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              <div className="text-2xl font-bold text-gray-900">
                                {selectedFlight.completed ? 'Abgeschlossen' : 'Läuft'}
                              </div>
                            </CardContent>
                          </Card>
                          <Card className="border border-gray-100 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                              <CardTitle className="text-sm font-medium text-gray-500">
                                Erstellt
                              </CardTitle>
                              <Calendar className="h-4 w-4 text-gray-400" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              <div className="text-2xl font-bold text-gray-900">
                                {tasting?.createdAt ? new Date(tasting.createdAt).toLocaleDateString() : 'k. A.'}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="leaderboard" className="space-y-4">
                    <Leaderboard 
                      tastingId={tastingId} 
                      displayCount={scoringRules?.displayCount || null}
                      currentUserId={user.id}
                    />
                  </TabsContent>

                  <TabsContent value="wines" className="space-y-4">
                    {selectedFlight && (
                      <div className="space-y-4">
                        {selectedFlight.wines?.map((wine) => (
                          <WineCard key={wine.id} wine={wine} isHost={true} />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader className="bg-gray-50 p-4 border-b border-gray-100">
                <h2 className="font-medium text-gray-900">Bestenliste</h2>
              </CardHeader>
              <CardContent className="p-4">
                <Leaderboard 
                  tastingId={tastingId} 
                  displayCount={scoringRules?.displayCount || 5}
                  currentUserId={user.id}
                />
              </CardContent>
            </Card>

            {/* Flight Selector */}
            {flights.length > 0 && (
              <Card className="border border-gray-100 shadow-sm">
                <CardHeader className="bg-gray-50 p-4 border-b border-gray-100">
                  <h2 className="font-medium text-gray-900">Flights</h2>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {flights.map((flight, index) => (
                      <button
                        key={flight.id}
                        onClick={() => {
                          setSelectedFlight(flight);
                          setSelectedFlightIndex(index);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                          selectedFlight?.id === flight.id ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{flight.name}</span>
                          {flight.completed ? (
                            <Badge variant="outline" className="border-green-100 bg-green-50 text-green-700">
                              Abgeschlossen
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">
                              Läuft
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {flight.wines?.length || 0} Weine
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
