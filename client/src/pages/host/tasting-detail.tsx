import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Wine, Clock, AlarmClock, X, Users, User, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast, useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";

// Dialoge für Erstellung von Flights und Hinzufügen von Weinen
import CreateFlightDialog from "@/components/flight/create-flight-dialog";
import AddWineDialog from "@/components/wine/add-wine-dialog";
import SetTimerDialog from "@/components/flight/set-timer-dialog";

// Definiere Typen für unsere Daten
interface Tasting {
  id: number;
  name: string;
  hostId: number;
  isPublic: boolean;
  status: string;
  createdAt: string;
  completedAt: string | null;
  password?: string;
}

interface Wine {
  id: number;
  flightId: number;
  name: string;
  producer: string;
  country: string;
  region: string;
  vintage: string;
  varietals: string[];
  letterCode: string;
}

interface Flight {
  id: number;
  tastingId: number;
  name: string;
  orderIndex: number;
  timeLimit: number;
  startedAt: string | null;
  completedAt: string | null;
  wines: Wine[];
}

export default function TastingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State für Dialoge
  const [createFlightOpen, setCreateFlightOpen] = useState(false);
  const [addWineDialogOpen, setAddWineDialogOpen] = useState(false);
  const [setTimerDialogOpen, setSetTimerDialogOpen] = useState(false);
  const [selectedFlightId, setSelectedFlightId] = useState<number | null>(null);
  
  // State für Timer-Countdown
  const [timerFlightId, setTimerFlightId] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  // State für Punktesystem und Einstellungen
  const [pointsConfiguration, setPointsConfiguration] = useState({
    producer: 1,
    name: 1,
    vintage: 1,
    country: 1,
    region: 1,
    varietals: 1,
    varietalsMode: 'per' // 'per' = Punkte pro Rebsorte, 'all' = Punkte nur wenn alle korrekt
  });
  const [leaderboardVisibility, setLeaderboardVisibility] = useState(3); // 0 = Alle anzeigen
  
  // Lade Tastings-Details
  const { data: tasting, isLoading: isTastingLoading, error: tastingError } = useQuery<Tasting>({
    queryKey: [`/api/tastings/${tastingId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tastings/${tastingId}`);
      return res.json();
    },
    enabled: !isNaN(tastingId),
  });

  // Lade Flights für diese Verkostung
  const { data: flights, isLoading: isFlightsLoading } = useQuery<Flight[]>({
    queryKey: [`/api/tastings/${tastingId}/flights`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tastings/${tastingId}/flights`);
      return res.json();
    },
    enabled: !isNaN(tastingId) && !!tasting,
  });
  
  // Timer-Effekt für aktive Flights
  useEffect(() => {
    if (!flights) return;
    
    // Finde einen aktiven Flight mit Timer
    const activeFlightWithTimer = flights.find(
      f => f.startedAt && !f.completedAt && f.timeLimit > 0
    );
    
    if (activeFlightWithTimer) {
      setTimerFlightId(activeFlightWithTimer.id);
      
      // Berechne die verbleibende Zeit
      const startTime = new Date(activeFlightWithTimer.startedAt!).getTime();
      const timeLimitMs = activeFlightWithTimer.timeLimit * 1000;
      const endTime = startTime + timeLimitMs;
      const now = Date.now();
      const remainingTime = Math.max(0, Math.floor((endTime - now) / 1000));
      
      setTimeLeft(remainingTime);
      
      // Starte den Timer, um die verbleibende Zeit zu aktualisieren
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null || prev <= 0) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    } else {
      setTimerFlightId(null);
      setTimeLeft(null);
    }
  }, [flights]);
  
  // Mutationen für Flight-Aktionen
  const startFlightMutation = useMutation({
    mutationFn: async (flightId: number) => {
      const response = await apiRequest("POST", `/api/flights/${flightId}/start`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Flight gestartet",
        description: "Der Flight wurde erfolgreich gestartet.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/flights`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: `Der Flight konnte nicht gestartet werden: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const completeFlightMutation = useMutation({
    mutationFn: async (flightId: number) => {
      const response = await apiRequest("POST", `/api/flights/${flightId}/complete`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Flight abgeschlossen",
        description: "Der Flight wurde erfolgreich abgeschlossen.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/flights`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: `Der Flight konnte nicht abgeschlossen werden: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Handler-Funktionen
  const handleAddWine = (flightId: number) => {
    setSelectedFlightId(flightId);
    setAddWineDialogOpen(true);
  };
  
  const handleStartFlight = (flightId: number) => {
    startFlightMutation.mutate(flightId);
  };
  
  const handleCompleteFlight = (flightId: number) => {
    completeFlightMutation.mutate(flightId);
  };
  
  const handleSetTimer = (flightId: number) => {
    setSelectedFlightId(flightId);
    setSetTimerDialogOpen(true);
  };
  
  // Punktesystem-Handler
  const handlePointsChange = (field: string, value: number) => {
    setPointsConfiguration(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Hier würde im fertigen System die API aufgerufen werden, um die Punkte-Konfiguration zu speichern
    toast({
      title: "Punktesystem aktualisiert",
      description: `Punkte für ${field} auf ${value} gesetzt.`,
    });
  };
  
  const handleVarietalsChange = (value: number) => {
    setPointsConfiguration(prev => ({
      ...prev,
      varietals: value
    }));
    
    toast({
      title: "Punktesystem aktualisiert",
      description: `Punkte für Rebsorten auf ${value} gesetzt.`,
    });
  };
  
  const handleVarietalsModeChange = (mode: 'per' | 'all') => {
    setPointsConfiguration(prev => ({
      ...prev,
      varietalsMode: mode
    }));
    
    toast({
      title: "Punktesystem aktualisiert",
      description: `Rebsorten-Modus auf "${mode === 'per' ? 'Punkte pro Rebsorte' : 'Punkte nur bei allen korrekt'}" gesetzt.`,
    });
  };
  
  // Einstellungen-Handler
  const handleLeaderboardVisibilityChange = (value: number) => {
    setLeaderboardVisibility(value);
    
    // Hier würde im fertigen System die API aufgerufen werden, um die Einstellung zu speichern
    let message = '';
    if (value === 0) {
      message = 'Alle Teilnehmer werden im Leaderboard angezeigt.';
    } else if (value === 1) {
      message = 'Nur der erste Platz wird öffentlich angezeigt.';
    } else {
      message = `Es werden nun die Top ${value} Platzierungen öffentlich angezeigt.`;
    }
    
    toast({
      title: "Einstellung gespeichert",
      description: message,
    });
  };

  // Statusänderung der Verkostung
  const updateTastingStatus = async (status: string) => {
    try {
      const res = await apiRequest("PATCH", `/api/tastings/${tastingId}/status`, { status });
      const updatedTasting = await res.json();
      
      queryClient.invalidateQueries({queryKey: [`/api/tastings/${tastingId}`]});
      
      toast({
        title: "Status aktualisiert",
        description: `Die Verkostung ist jetzt ${status === 'active' ? 'aktiv' : status === 'completed' ? 'abgeschlossen' : 'im Entwurfsmodus'}.`,
      });
      
      return updatedTasting;
    } catch (error) {
      toast({
        title: "Fehler",
        description: `Fehler beim Ändern des Status: ${(error as Error).message}`,
        variant: "destructive",
      });
    }
  };

  if (isTastingLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#4C0519]" />
      </div>
    );
  }

  if (tastingError) {
    return (
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <Card className="border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-red-800">Fehler beim Laden der Verkostung</CardTitle>
            <CardDescription className="text-red-600">
              {(tastingError as Error).message}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p>Die Verkostung konnte nicht geladen werden. Bitte versuchen Sie es später erneut.</p>
            <Button 
              className="mt-4 bg-[#4C0519] hover:bg-[#3A0413]"
              onClick={() => window.history.back()}
            >
              Zurück
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tasting) {
    return (
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Verkostung nicht gefunden</CardTitle>
            <CardDescription>
              Die angeforderte Verkostung existiert nicht oder Sie haben keinen Zugriff darauf.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="mt-4 bg-[#4C0519] hover:bg-[#3A0413]"
              onClick={() => window.history.back()}
            >
              Zurück
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isHost = tasting.hostId === (user?.id || 1); // Temporär: Fallback für Entwicklung

  return (
    <div className="container max-w-5xl mx-auto py-10 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Wine className="h-6 w-6 text-[#4C0519]" />
            {tasting.name}
          </h1>
          <div className="flex gap-2 items-center">
            <Badge variant={tasting.status === 'active' ? 'default' : tasting.status === 'completed' ? 'secondary' : 'outline'}>
              {tasting.status === 'active' ? 'Aktiv' : tasting.status === 'completed' ? 'Abgeschlossen' : 'Entwurf'}
            </Badge>
            <Badge variant={tasting.isPublic ? 'default' : 'outline'}>
              {tasting.isPublic ? 'Öffentlich' : 'Privat'}
            </Badge>
          </div>
        </div>

        {isHost && (
          <div className="flex gap-2">
            {tasting.status === 'draft' && (
              <>
                <Button 
                  onClick={() => updateTastingStatus('active')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Verkostung starten
                </Button>
                <Button 
                  onClick={() => updateTastingStatus('saved')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Speichern
                </Button>
              </>
            )}
            {tasting.status === 'active' && (
              <Button 
                onClick={() => updateTastingStatus('completed')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Verkostung abschließen
              </Button>
            )}
            {tasting.status === 'completed' && (
              <Button 
                onClick={() => updateTastingStatus('active')}
                variant="outline"
              >
                Wieder aktivieren
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="flights" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="flights">Flights</TabsTrigger>
          <TabsTrigger value="participants">Teilnehmer</TabsTrigger>
          <TabsTrigger value="scoring">Punktesystem</TabsTrigger>
          {isHost && <TabsTrigger value="settings">Einstellungen</TabsTrigger>}
        </TabsList>

        <TabsContent value="flights" className="space-y-6">
          {isFlightsLoading ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#4C0519]" />
            </div>
          ) : flights && flights.length > 0 ? (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {flights.map((flight: any) => (
                  <Card key={flight.id} className="overflow-hidden">
                    <CardHeader className="bg-gray-50">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-xl">Flight {flight.orderIndex + 1}</CardTitle>
                        <Badge variant={flight.completedAt ? 'secondary' : flight.startedAt ? 'default' : 'outline'}>
                          {flight.completedAt ? 'Abgeschlossen' : flight.startedAt ? 'Im Gange' : 'Nicht gestartet'}
                        </Badge>
                      </div>
                      <CardDescription className="flex justify-between items-center">
                        <span>{flight.wines?.length || 0} Weine</span>
                        {timeLeft !== null && timerFlightId === flight.id && (
                          <div className="flex items-center text-amber-600 font-medium">
                            <AlarmClock className="h-4 w-4 mr-1 animate-pulse" />
                            <span>
                              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {flight.wines && flight.wines.length > 0 ? (
                        <div className="grid gap-2">
                          {flight.wines.map((wine: any) => (
                            <div key={wine.id} className="flex items-center p-2 rounded bg-gray-50">
                              <div className="h-8 w-8 flex items-center justify-center bg-[#4C0519] text-white rounded-full mr-3">
                                {wine.letterCode}
                              </div>
                              <div>
                                <p className="font-medium">{wine.producer} {wine.name}</p>
                                <p className="text-sm text-gray-500">{wine.region}, {wine.country}, {wine.vintage}</p>
                                <p className="text-sm text-gray-600 italic">{wine.varietals && wine.varietals.join(', ')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">Keine Weine in diesem Flight</p>
                      )}

                      {isHost && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddWine(flight.id)}
                            className="w-full"
                          >
                            Wein hinzufügen
                          </Button>
                          {!flight.startedAt && (
                            <Button
                              size="sm"
                              onClick={() => handleStartFlight(flight.id)}
                              className="w-full bg-[#4C0519] hover:bg-[#3A0413]"
                              disabled={tasting.status !== 'active'}
                            >
                              Flight starten
                            </Button>
                          )}
                          {flight.startedAt && !flight.completedAt && (
                            <div className="flex w-full gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSetTimer(flight.id)}
                                className="w-1/2 bg-amber-600 hover:bg-amber-700"
                              >
                                <Clock className="mr-1 h-4 w-4" />
                                Timer starten
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleCompleteFlight(flight.id)}
                                className="w-1/2 bg-blue-600 hover:bg-blue-700"
                              >
                                Flight abschließen
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Button zum Hinzufügen weiterer Flights */}
              {isHost && tasting.status === 'draft' && (
                <div className="flex justify-center">
                  <Button 
                    className="w-full md:w-auto bg-[#4C0519] hover:bg-[#3A0413]"
                    onClick={() => setCreateFlightOpen(true)}
                  >
                    Weiteren Flight hinzufügen
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500 my-8">
                  Keine Flights für diese Verkostung.
                </p>
                {isHost && tasting.status === 'draft' && (
                  <Button 
                    className="w-full bg-[#4C0519] hover:bg-[#3A0413]"
                    onClick={() => setCreateFlightOpen(true)}
                  >
                    Neuen Flight erstellen
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="participants">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-[#4C0519]" />
                  Teilnehmer
                </CardTitle>
                <CardDescription>
                  Teilnehmer dieser Verkostung und deren Punktestand
                </CardDescription>
              </div>
              {isHost && tasting.status !== 'completed' && (
                <Badge variant="outline" className="ml-2">
                  {/* Dies würde dynamisch sein */}
                  3 Teilnehmer
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {/* Mock-Daten für die UI-Vorschau */}
              <div className="space-y-4">
                {/* Teilnehmer-Liste */}
                <div className="rounded-md border">
                  <div className="bg-gray-50 p-3 flex justify-between items-center font-medium text-sm">
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2 text-gray-500" />
                      <span>Name</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center">
                        <Trophy className="h-4 w-4 mr-2 text-gray-500" />
                        <span>Punkte</span>
                      </div>
                      {isHost && (
                        <span className="text-gray-500">Entfernen</span>
                      )}
                    </div>
                  </div>
                  <div className="divide-y">
                    {[
                      { id: 1, name: "Max Mustermann", company: "Weingut A", score: 18, profileImage: "https://i.pravatar.cc/150?img=1" },
                      { id: 2, name: "Anna Schmidt", company: "Weinhandlung B", score: 15, profileImage: "https://i.pravatar.cc/150?img=5" },
                      { id: 3, name: "Thomas Müller", company: "Privat", score: 12, profileImage: "https://i.pravatar.cc/150?img=8" }
                    ].map((participant) => (
                      <div key={participant.id} className="p-4 flex justify-between items-center">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full overflow-hidden mr-3 flex-shrink-0">
                            <img 
                              src={participant.profileImage} 
                              alt={`Profilbild von ${participant.name}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-medium">{participant.name}</p>
                            <p className="text-sm text-gray-500">{participant.company}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="w-16 text-right">
                            <span className="font-bold">{participant.score}</span>
                            <span className="text-gray-500 text-sm ml-1">Pkt.</span>
                          </div>
                          {isHost && (
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" title="Teilnehmer entfernen">
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hinweis, wenn keine Teilnehmer vorhanden sind */}
                {false && (
                  <p className="text-center text-gray-500 my-8">
                    Keine Teilnehmer für diese Verkostung.
                  </p>
                )}
                
                {tasting.status === 'completed' && (
                  <div className="bg-gray-50 p-4 rounded-md border">
                    <h3 className="font-medium flex items-center">
                      <Trophy className="h-5 w-5 mr-2 text-amber-500" />
                      Endergebnis
                    </h3>
                    <p className="text-sm text-gray-500 mt-2">
                      Die Verkostung ist abgeschlossen. Die endgültigen Platzierungen werden oben angezeigt.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scoring">
          <Card>
            <CardHeader>
              <CardTitle>Punktesystem</CardTitle>
              <CardDescription>
                Legen Sie fest, wie viele Punkte für korrekt identifizierte Weinmerkmale vergeben werden (0-5 Punkte)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isHost ? (
                <div className="space-y-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Produzent:</label>
                        <div className="flex items-center space-x-2">
                          {[0, 1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              className={`w-10 h-10 rounded-full ${
                                pointsConfiguration.producer === value 
                                  ? 'bg-[#4C0519] text-white' 
                                  : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                              onClick={() => handlePointsChange('producer', value)}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Name:</label>
                        <div className="flex items-center space-x-2">
                          {[0, 1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              className={`w-10 h-10 rounded-full ${
                                pointsConfiguration.name === value 
                                  ? 'bg-[#4C0519] text-white' 
                                  : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                              onClick={() => handlePointsChange('name', value)}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Jahrgang:</label>
                        <div className="flex items-center space-x-2">
                          {[0, 1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              className={`w-10 h-10 rounded-full ${
                                pointsConfiguration.vintage === value 
                                  ? 'bg-[#4C0519] text-white' 
                                  : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                              onClick={() => handlePointsChange('vintage', value)}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Land:</label>
                        <div className="flex items-center space-x-2">
                          {[0, 1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              className={`w-10 h-10 rounded-full ${
                                pointsConfiguration.country === value 
                                  ? 'bg-[#4C0519] text-white' 
                                  : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                              onClick={() => handlePointsChange('country', value)}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Region:</label>
                        <div className="flex items-center space-x-2">
                          {[0, 1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              className={`w-10 h-10 rounded-full ${
                                pointsConfiguration.region === value 
                                  ? 'bg-[#4C0519] text-white' 
                                  : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                              onClick={() => handlePointsChange('region', value)}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Rebsorten:</label>
                        <div className="flex items-center space-x-2">
                          {[0, 1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              className={`w-10 h-10 rounded-full ${
                                pointsConfiguration.varietals === value 
                                  ? 'bg-[#4C0519] text-white' 
                                  : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                              onClick={() => handleVarietalsChange(value)}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Rebsorten-Wertung:</label>
                        <div className="flex flex-col gap-2">
                          <button
                            className={`px-4 py-2 rounded text-sm ${
                              pointsConfiguration.varietalsMode === 'per' 
                                ? 'bg-[#4C0519] text-white' 
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                            onClick={() => handleVarietalsModeChange('per')}
                          >
                            Punkte pro korrekte Rebsorte
                          </button>
                          <button
                            className={`px-4 py-2 rounded text-sm ${
                              pointsConfiguration.varietalsMode === 'all' 
                                ? 'bg-[#4C0519] text-white' 
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                            onClick={() => handleVarietalsModeChange('all')}
                          >
                            Punkte nur wenn alle Rebsorten korrekt
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <div className="text-lg font-medium">Maximale Punktzahl pro Wein: {
                        Object.entries(pointsConfiguration)
                          .filter(([key]) => key !== 'varietalsMode')
                          .map(([_, value]) => typeof value === 'number' ? value : 0)
                          .reduce((sum, value) => sum + value, 0)
                      }</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 my-8">
                  Punktesystem wird vom Host festgelegt.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isHost && (
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Einstellungen</CardTitle>
                <CardDescription>
                  Konfigurieren Sie allgemeine Einstellungen für diese Verkostung
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Leaderboard-Anzeige</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Legen Sie fest, wie viele Teilnehmer auf dem öffentlichen Leaderboard angezeigt werden sollen. 
                      Nur der Host kann alle Platzierungen sehen.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="flex flex-col space-y-2">
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-medium">
                            {leaderboardVisibility === 0
                              ? "Alle Teilnehmer werden angezeigt"
                              : `Anzahl der angezeigten Platzierungen: ${leaderboardVisibility}`}
                          </label>
                          <button
                            onClick={() => handleLeaderboardVisibilityChange(0)}
                            className={`text-xs px-2 py-1 rounded ${
                              leaderboardVisibility === 0
                                ? "bg-[#4C0519] text-white"
                                : "bg-gray-100 hover:bg-gray-200"
                            }`}
                          >
                            Alle anzeigen
                          </button>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="10" 
                          value={leaderboardVisibility}
                          onChange={(e) => handleLeaderboardVisibilityChange(parseInt(e.target.value))}
                          className="w-full accent-[#4C0519]"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Alle</span>
                          <span>5</span>
                          <span>10</span>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded border">
                        <h4 className="font-medium mb-2">Vorschau:</h4>
                        <div className="space-y-2">
                          {leaderboardVisibility === 0 ? (
                            // Zeige alle Teilnehmer an (hier fünf für die Vorschau)
                            Array.from({length: 5}).map((_, index) => (
                              <div key={index} className="flex justify-between items-center p-2 bg-white rounded">
                                <div className="flex items-center">
                                  <div className="relative mr-2">
                                    <div className="w-8 h-8 rounded-full overflow-hidden">
                                      <img 
                                        src={`https://i.pravatar.cc/150?img=${index + 1}`} 
                                        alt={`Profilbild Teilnehmer ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border border-white ${
                                      index === 0 ? 'bg-yellow-500' : 
                                      index === 1 ? 'bg-gray-400' : 
                                      index === 2 ? 'bg-amber-700' : 'bg-[#4C0519]'
                                    } text-white text-[10px] font-bold`}>
                                      {index + 1}
                                    </div>
                                  </div>
                                  <span className="font-medium">Teilnehmer {index + 1}</span>
                                </div>
                                <span className="text-sm font-bold">{(20 - index * 2)} Punkte</span>
                              </div>
                            ))
                          ) : (
                            // Zeige nur die angegebene Anzahl an Platzierungen
                            Array.from({length: leaderboardVisibility}).map((_, index) => (
                              <div key={index} className="flex justify-between items-center p-2 bg-white rounded">
                                <div className="flex items-center">
                                  <div className="relative mr-2">
                                    <div className="w-8 h-8 rounded-full overflow-hidden">
                                      <img 
                                        src={`https://i.pravatar.cc/150?img=${index + 1}`} 
                                        alt={`Profilbild Teilnehmer ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border border-white ${
                                      index === 0 ? 'bg-yellow-500' : 
                                      index === 1 ? 'bg-gray-400' : 
                                      index === 2 ? 'bg-amber-700' : 'bg-[#4C0519]'
                                    } text-white text-[10px] font-bold`}>
                                      {index + 1}
                                    </div>
                                  </div>
                                  <span className="font-medium">Teilnehmer {index + 1}</span>
                                </div>
                                <span className="text-sm font-bold">{(20 - index * 2)} Punkte</span>
                              </div>
                            ))
                          )}
                          
                          {leaderboardVisibility > 0 && leaderboardVisibility < 5 && (
                            <div className="text-center text-gray-500 text-sm py-2 border-t">
                              Weitere Platzierungen sind nur für den Host sichtbar
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      
      {/* Dialoge */}
      <CreateFlightDialog 
        tastingId={tastingId}
        open={createFlightOpen}
        onOpenChange={setCreateFlightOpen}
      />
      
      {selectedFlightId && (
        <>
          <AddWineDialog 
            flightId={selectedFlightId}
            open={addWineDialogOpen}
            onOpenChange={setAddWineDialogOpen}
          />
          
          <SetTimerDialog
            flightId={selectedFlightId}
            open={setTimerDialogOpen}
            onOpenChange={setSetTimerDialogOpen}
          />
        </>
      )}
    </div>
  );
}