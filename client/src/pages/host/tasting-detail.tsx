import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Loader2, Wine, Clock, AlarmClock, X, Users, Trophy, User as UserIcon } from "lucide-react";

// Typdefinitionen
interface User {
  id: number;
  email: string;
  name: string;
  company?: string;
  profileImage?: string;
  createdAt: string;
}
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast, useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";

interface Participant {
  id: number;
  userId: number;
  tastingId: number;
  name?: string;
  score?: number;
  user?: {
    id: number;
    name: string;
    email: string;
    company?: string;
    profileImage?: string;
  };
}

// Dialoge für Erstellung von Flights und Hinzufügen von Weinen
import AddWineDialog from "@/components/wine/add-wine-dialog";
import SetTimerDialog from "@/components/flight/set-timer-dialog";
import CreateFlightDialog from "@/components/flight/create-flight-dialog";

// Definiere Typen für unsere Daten
interface Tasting {
  id: number;
  name: string;
  hostId: number;
  hostName: string;
  hostCompany: string | null;
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

// Guess stats response types
interface FlightGuessStats {
  flightId: number;
  tastingId: number;
  stats: Array<{ wineId: number; letterCode: string; submitted: number; total: number; missing: number }>;
}

function FlightWineList({ flight }: { flight: Flight }) {
  const { data: guessStats } = useQuery<FlightGuessStats>({
    queryKey: ["flight-guess-stats", flight.id],
    queryFn: async () => {
      const res = await fetch(`/api/flights/${flight.id}/guess-stats`, { credentials: 'include' });
      if (!res.ok) throw new Error('Fehler beim Laden der Tipp-Statistiken');
      return res.json();
    },
    refetchInterval: 3000,
    enabled: !!flight?.id,
  });

  const statsMap = new Map<number, { submitted: number; total: number; missing: number }>();
  guessStats?.stats.forEach(s => statsMap.set(s.wineId, { submitted: s.submitted, total: s.total, missing: s.missing }));

  if (!flight.wines || flight.wines.length === 0) {
    return <p className="text-gray-500 italic">Keine Weine in diesem Flight</p>;
  }

  return (
    <div className="grid gap-2">
      {flight.wines.map((wine: any) => {
        const s = statsMap.get(wine.id);
        return (
          <div key={wine.id} className="flex items-center justify-between p-2 rounded bg-gray-50">
            <div className="flex items-center">
              <div className="h-8 w-8 flex items-center justify-center bg-[#274E37] text-white rounded-full mr-3">
                {wine.letterCode}
              </div>
              <div>
                <p className="font-medium">{wine.producer} {wine.name}</p>
                <p className="text-sm text-gray-500">{wine.region}, {wine.country}, {wine.vintage}</p>
                <p className="text-sm text-gray-600 italic">{wine.varietals && wine.varietals.join(', ')}</p>
              </div>
            </div>
            <div className="text-sm text-gray-700 whitespace-nowrap ml-4">
              {s ? (
                <span>
                  Tipps: <span className="font-semibold text-[#274E37]">{s.submitted}</span> / {s.total}
                  {s.missing > 0 && <span className="ml-2 text-amber-600">({s.missing} fehlen)</span>}
                </span>
              ) : (
                <span className="text-gray-400">Tipps: –</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TastingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");

  // Typ für Teilnehmer mit Benutzerdaten
  interface ParticipantWithUser extends Participant {
    user: User;
    isHost: boolean;
  }

  // State für Timer-Countdown (muss VOR Effekten definiert sein, die ihn verwenden)
  const [timerFlightId, setTimerFlightId] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [wsTimerActive, setWsTimerActive] = useState(false);
  const [autoCompleteTriggered, setAutoCompleteTriggered] = useState(false);

  // Teilnehmer laden
  const { data: participants = [], isLoading: isParticipantsLoading, refetch: refetchParticipants } = useQuery<ParticipantWithUser[]>({
    queryKey: [`/api/tastings/${tastingId}/participants`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tastings/${tastingId}/participants`);
      if (!res.ok) {
        throw new Error('Fehler beim Laden der Teilnehmer');
      }
      const data = await res.json();
      return data;
    },
    enabled: !isNaN(tastingId),
  });

  // WebSocket-Verbindung für Echtzeit-Updates
  useEffect(() => {
    if (!tastingId || isNaN(tastingId)) return;

    let ws: WebSocket;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 1000; // 1 Sekunde

    const connectWebSocket = () => {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(
        `${protocol}://${window.location.host}/ws/join?t=${tastingId}&host=true`
      );

      ws.onopen = () => {
        console.log('WebSocket-Verbindung hergestellt');
        reconnectAttempts = 0; // Reset der Verbindungsversuche bei erfolgreicher Verbindung
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          // Reagiere auf verschiedene Nachrichtentypen
          if (data.type === 'participants_updated' || 
              data.type === 'participant_joined' || 
              data.type === 'participant_removed') {
            
            console.log('Aktualisiere Teilnehmerliste...');
            
            // Verwende queryClient direkt, um die Daten zu aktualisieren
            queryClient.invalidateQueries({ 
              queryKey: [`/api/tastings/${tastingId}/participants`] 
            }).then(() => {
              console.log('Teilnehmerliste erfolgreich aktualisiert');
              
              // Zeige eine Benachrichtigung an, wenn ein neuer Teilnehmer beigetreten ist
              if ((data.type === 'participant_joined' || data.type === 'participants_updated') && data.newParticipant) {
                const participantName = data.newParticipant.user?.name || 'Ein neuer Teilnehmer';
                toast({
                  title: "Neuer Teilnehmer",
                  description: `${participantName} ist der Verkostung beigetreten`,
                  variant: "default"
                });
              }
            }).catch(error => {
              console.error('Fehler beim Aktualisieren der Teilnehmerliste:', error);
            });
          } else if (data.type === 'timer_started') {
            // Host: lokalen Countdown aktivieren
            if (typeof data.flightId === 'number' && typeof data.timeLimit === 'number') {
              setTimerFlightId(data.flightId);
              setTimeLeft(Math.max(0, Math.floor(Number(data.timeLimit))));
              // Dialog schließen, falls noch offen
              setSetTimerDialogOpen(false);
              setWsTimerActive(true);
            }
          } else if (data.type === 'flight_completed') {
            // Timer zurücksetzen und Daten auffrischen
            setTimerFlightId(null);
            setTimeLeft(null);
            setWsTimerActive(false);
            queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/flights`] });
          } else if (data.type === 'tasting_status') {
            // Status der Verkostung hat sich geändert (z.B. completed)
            queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}`] });
          }
        } catch (e) {
          console.error('Fehler beim Verarbeiten der WebSocket-Nachricht:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket Fehler:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket-Verbindung geschlossen, versuche erneut zu verbinden...');
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(connectWebSocket, reconnectDelay * reconnectAttempts);
        }
      };
    };

    // Initiale Verbindung herstellen
    connectWebSocket();

    // Cleanup-Funktion
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [tastingId, refetchParticipants, toast]);

  // Lokaler Countdown, wenn WS den Timer gestartet hat
  useEffect(() => {
    if (!wsTimerActive || !timerFlightId || timeLeft === null) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return prev;
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [wsTimerActive, timerFlightId, timeLeft]);

  // Falls der Serverabschluss ausbleibt: Flight clientseitig abschließen
  useEffect(() => {
    if (!wsTimerActive || !timerFlightId) return;
    if (timeLeft === 0 && !autoCompleteTriggered) {
      setAutoCompleteTriggered(true);
      completeFlightMutation.mutate(timerFlightId);
    }
    // reset trigger when a new timer starts
    if (timeLeft !== 0 && autoCompleteTriggered) {
      setAutoCompleteTriggered(false);
    }
  }, [wsTimerActive, timeLeft, timerFlightId]);

  // Teilnehmer entfernen
  const removeParticipantMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/tastings/${tastingId}/participants/${userId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Entfernen des Teilnehmers');
      }
      return response.json();
    },
    onSuccess: () => {
      // Die WebSocket-Nachricht wird die Liste aktualisieren
      toast({
        title: "Teilnehmer entfernt",
        description: "Der Teilnehmer wurde erfolgreich aus der Verkostung entfernt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Entfernen des Teilnehmers: ${(error as Error).message}`,
        variant: "destructive",
      });
    },
  });

  const handleRemoveParticipant = (userId: number) => {
    if (window.confirm("Möchten Sie diesen Teilnehmer wirklich aus der Verkostung entfernen?")) {
      removeParticipantMutation.mutate(userId);
    }
  };
  
  // State für Dialoge
  const [addWineDialogOpen, setAddWineDialogOpen] = useState(false);
  const [setTimerDialogOpen, setSetTimerDialogOpen] = useState(false);
  const [createFlightDialogOpen, setCreateFlightDialogOpen] = useState(false);
  const [selectedFlightId, setSelectedFlightId] = useState<number | null>(null);
  
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

  // Flights-Query mit Debug-Log
  const { data: flights, isLoading: isFlightsLoading, refetch: refetchFlights } = useQuery<Flight[]>({
    queryKey: [`/api/tastings/${tastingId}/flights`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tastings/${tastingId}/flights`);
      const data = await res.json();
      console.log('API /flights result:', data);
      return data;
    },
    enabled: !isNaN(tastingId) && !!tasting,
    staleTime: 0, // Immer sofort neu laden!
  });

  // Flag: Alle Flights abgeschlossen
  const allFlightsCompleted = useMemo(() => (flights && flights.length > 0 && flights.every(f => !!f.completedAt)), [flights]);

  // Letzter abgeschlossener Flight (für Zwischenergebnis)
  const lastCompletedFlight = useMemo(() => {
    const completed = (flights || []).filter(f => !!f.completedAt);
    if (completed.length === 0) return null;
    completed.sort((a, b) => new Date(b.completedAt as any).getTime() - new Date(a.completedAt as any).getTime());
    return completed[0];
  }, [flights]);

  // Stats für letzten abgeschlossenen Flight
  const { data: lastCompletedStats } = useQuery<any>({
    queryKey: lastCompletedFlight?.id ? ["/api/flights", lastCompletedFlight.id, "stats", "latest"] : ["latest-flight-stats", "none"],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/flights/${lastCompletedFlight!.id}/stats`);
      if (!res.ok) throw new Error('Fehler beim Laden der Zwischenergebnisse');
      return res.json();
    },
    enabled: !!lastCompletedFlight?.id && !allFlightsCompleted,
  });

  // Final-Statistiken, wenn alles abgeschlossen
  const { data: finalStats } = useQuery<any>({
    queryKey: allFlightsCompleted ? ["/api/tastings", tastingId, "final-stats"] : ["final-stats", "none"],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/final-stats`);
      if (!res.ok) throw new Error('Fehler beim Laden der Endergebnis-Statistiken');
      return res.json();
    },
    enabled: !!tastingId && allFlightsCompleted,
  });

  // Einladungen laden
  type Invite = { tastingId: number; email: string; role: string };
  const { data: invites = [], refetch: refetchInvites } = useQuery<Invite[]>({
    queryKey: ["invites", tastingId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tastings/${tastingId}/invites`);
      return res.json();
    },
    enabled: !isNaN(tastingId),
  });

  const addInviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", `/api/tastings/${tastingId}/invites`, { email });
      return res.json();
    },
    onSuccess: async () => {
      await refetchInvites();
      setInviteEmail("");
      toast({ title: "Einladung hinzugefügt" });
    },
    onError: (e: Error) => {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  });

  const removeInviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("DELETE", `/api/tastings/${tastingId}/invites/${encodeURIComponent(email)}`);
      return res.json();
    },
    onSuccess: async () => {
      await refetchInvites();
      toast({ title: "Einladung entfernt" });
    },
    onError: (e: Error) => {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  });

  // Logge Flights nach jedem Update
  useEffect(() => {
    console.log('Flights in UI:', flights);
  }, [flights]);
  
  // Timer aus Flight-Daten herleiten (Fallback, wenn kein WS-Start bekannt)
  useEffect(() => {
    if (!flights) return;
    if (timerFlightId && timeLeft !== null) return; // WS hat Vorrang

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
  
  // Nach dem Hinzufügen eines Weins Flights mit Delay refetchen
  const handleWineAdded = () => {
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/flights`] });
    }, 300);
    setAddWineDialogOpen(false);
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
  const updateTastingStatus = async (status: 'draft' | 'active' | 'started') => {
    try {
      const res = await apiRequest("PATCH", `/api/tastings/${tastingId}/status`, { status });
      const updatedTasting = await res.json();
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({queryKey: ["/api/tastings"]});
      queryClient.invalidateQueries({queryKey: [`/api/tastings/${tastingId}`]});
      
      toast({
        title: "Status aktualisiert",
        description: status === 'active' 
          ? "Die Verkostung wurde veröffentlicht und ist jetzt aktiv"
          : status === 'started'
          ? "Die Verkostung wurde gestartet"
          : "Die Verkostung wurde zurück in den Entwurfsmodus gesetzt",
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

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isStartingFlight, setIsStartingFlight] = useState(false);

  const startNextFlight = async () => {
    setIsStartingFlight(true);
    try {
      // Finde den nächsten nicht gestarteten und nicht abgeschlossenen Flight
      const nextFlight = (flights || []).find(f => !f.startedAt && !f.completedAt);
      if (!nextFlight) {
        toast({ title: 'Kein startbarer Flight', description: 'Es gibt keinen weiteren ungestarteten Flight.' });
        return;
      }

      // Starte den Flight
      const res = await fetch(`/api/flights/${nextFlight.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'Flight konnte nicht gestartet werden');
      }

      toast({ title: 'Flight gestartet', description: `${nextFlight.name || 'Nächster Flight'} wurde gestartet.` });
      await queryClient.invalidateQueries({ queryKey: ['flights', tastingId] });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message || 'Flight Start fehlgeschlagen', variant: 'destructive' });
    } finally {
      setIsStartingFlight(false);
    }
  };

  if (isTastingLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#274E37]" />
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
              className="mt-4 bg-[#274E37] hover:bg-[#e65b2d]"
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
              className="mt-4 bg-[#274E37] hover:bg-[#e65b2d]"
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
  console.log('[DEBUG TastingDetailPage] isHost:', isHost, 'status:', tasting.status, 'user:', user, 'tasting:', tasting);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{tasting.name}</h1>
          <div className="flex gap-2 mt-2">
            <Badge variant={allFlightsCompleted ? 'secondary' : tasting.status === 'active' ? 'default' : tasting.status === 'started' ? 'secondary' : 'outline'}>
              {allFlightsCompleted ? 'Abgeschlossen' : tasting.status === 'active' ? 'Aktiv' : tasting.status === 'started' ? 'Gestartet' : 'Entwurf'}
            </Badge>
            <Badge variant={tasting.isPublic ? 'default' : 'outline'}>
              {tasting.isPublic ? 'Öffentlich' : 'Privat'}
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          {tasting.status === 'draft' && !allFlightsCompleted && (
            <Button onClick={() => updateTastingStatus('active')} disabled={isUpdatingStatus}>
              Verkostung veröffentlichen
            </Button>
          )}
          {tasting.status === 'active' && !allFlightsCompleted && (
            <Button onClick={() => updateTastingStatus('started')} disabled={isUpdatingStatus}>
              Verkostung starten
            </Button>
          )}
          {tasting.status === 'started' && !allFlightsCompleted && (
            <Button onClick={startNextFlight} disabled={isStartingFlight}>
              Nächster Flight starten
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="flights" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="flights">Flights</TabsTrigger>
          <TabsTrigger value="participants">
            Teilnehmer ({participants ? participants.filter(p => p.user?.id !== tasting?.hostId).length : 0})
          </TabsTrigger>
          <TabsTrigger value="scoring">Punktesystem</TabsTrigger>
          {isHost && <TabsTrigger value="settings">Einstellungen</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="participants" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Teilnehmer verwalten</CardTitle>
              <CardDescription>
                Hier sehen Sie alle Teilnehmer, die der Verkostung beigetreten sind.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasting && user?.id === tasting.hostId && (
                <div className="mb-6">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Einladungen
                  </h4>
                  <div className="flex gap-2 mb-3">
                    <Input 
                      placeholder="name@example.com" 
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const email = inviteEmail.trim().toLowerCase();
                          if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                            addInviteMutation.mutate(email);
                          } else {
                            toast({ title: 'Ungültige E-Mail', variant: 'destructive' });
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const email = inviteEmail.trim().toLowerCase();
                        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                          addInviteMutation.mutate(email);
                        } else {
                          toast({ title: 'Ungültige E-Mail', variant: 'destructive' });
                        }
                      }}
                      disabled={addInviteMutation.isPending}
                    >
                      Hinzufügen
                    </Button>
                  </div>
                  {invites.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {invites.map((i) => (
                        <span key={i.email} className="inline-flex items-center gap-2 bg-gray-100 text-gray-800 rounded-full px-3 py-1 text-sm">
                          {i.email}
                          <button
                            type="button"
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => removeInviteMutation.mutate(i.email)}
                            aria-label={`Entferne ${i.email}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Noch keine Einladungen</p>
                  )}
                </div>
              )}
              {isParticipantsLoading ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-6 w-6 animate-spin text-[#274E37]" />
                </div>
              ) : participants && participants.length > 0 ? (
                <div className="space-y-3">
                  {participants
                    // Filtere den Veranstalter aus der Teilnehmerliste
                    .filter(participant => participant.user?.id !== tasting.hostId)
                    .map((participant) => (
                      <div 
                        key={participant.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {participant.user?.profileImage ? (
                              <img 
                                src={participant.user.profileImage} 
                                alt={participant.user.name || 'Profilbild'} 
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  // Fallback, falls das Bild nicht geladen werden kann
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.parentElement?.querySelector('svg')?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <UserIcon className={`h-5 w-5 text-gray-500 ${participant.user?.profileImage ? 'hidden' : ''}`} />
                          </div>
                          <div>
                            <p className="font-medium">{participant.user?.name || 'Unbekannter Benutzer'}</p>
                            <p className="text-sm text-gray-500">
                              {participant.user?.company || 'Keine Firma angegeben'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {isHost && participant.user?.id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleRemoveParticipant(participant.userId)}
                              title="Teilnehmer entfernen"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <UserIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Noch keine Teilnehmer beigetreten.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flights" className="space-y-6">
          {/* Kompakte Statistiken: Zwischen- oder Endergebnis */}
          {!allFlightsCompleted && lastCompletedFlight && lastCompletedStats && (
            <Card>
              <CardHeader>
                <CardTitle>Zwischenergebnis – {lastCompletedFlight.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Bester Verkoster: </span>
                  {lastCompletedStats.topScorer ? `${lastCompletedStats.topScorer.userName} (${lastCompletedStats.topScorer.score} Pkt)` : '—'}
                </div>
                <div>
                  <span className="font-medium">Am besten erkannt: </span>
                  {lastCompletedStats.bestRecognizedWine ? `(${lastCompletedStats.bestRecognizedWine.letterCode}) ${lastCompletedStats.bestRecognizedWine.producer} ${lastCompletedStats.bestRecognizedWine.name} – ∅ ${Number(lastCompletedStats.bestRecognizedWine.avgScore).toFixed(2)} Pkt` : '—'}
                </div>
                <div>
                  <span className="font-medium">Am schlechtesten erkannt: </span>
                  {lastCompletedStats.worstRecognizedWine ? `(${lastCompletedStats.worstRecognizedWine.letterCode}) ${lastCompletedStats.worstRecognizedWine.producer} ${lastCompletedStats.worstRecognizedWine.name} – ∅ ${Number(lastCompletedStats.worstRecognizedWine.avgScore).toFixed(2)} Pkt` : '—'}
                </div>
                <div>
                  <span className="font-medium">Bestbewertet: </span>
                  {lastCompletedStats.bestRatedWine && lastCompletedStats.bestRatedWine.count > 0 ? `(${lastCompletedStats.bestRatedWine.letterCode}) ${lastCompletedStats.bestRatedWine.producer} ${lastCompletedStats.bestRatedWine.name} – ∅ ${Number(lastCompletedStats.bestRatedWine.avgRating).toFixed(2)} (${lastCompletedStats.bestRatedWine.count})` : '—'}
                </div>
                <div>
                  <span className="font-medium">Schlecht bewertet: </span>
                  {lastCompletedStats.worstRatedWine && lastCompletedStats.worstRatedWine.count > 0 ? `(${lastCompletedStats.worstRatedWine.letterCode}) ${lastCompletedStats.worstRatedWine.producer} ${lastCompletedStats.worstRatedWine.name} – ∅ ${Number(lastCompletedStats.worstRatedWine.avgRating).toFixed(2)} (${lastCompletedStats.worstRatedWine.count})` : '—'}
                </div>
              </CardContent>
            </Card>
          )}

          {allFlightsCompleted && finalStats && (
            <Card>
              <CardHeader>
                <CardTitle>Endergebnis‑Statistiken</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Am besten erkannt (gesamt): </span>
                  {finalStats.bestRecognizedWine ? `(${finalStats.bestRecognizedWine.letterCode}) ${finalStats.bestRecognizedWine.producer} ${finalStats.bestRecognizedWine.name} – ∅ ${Number(finalStats.bestRecognizedWine.avgScore).toFixed(2)} Pkt` : '—'}
                </div>
                <div>
                  <span className="font-medium">Am schlechtesten erkannt (gesamt): </span>
                  {finalStats.worstRecognizedWine ? `(${finalStats.worstRecognizedWine.letterCode}) ${finalStats.worstRecognizedWine.producer} ${finalStats.worstRecognizedWine.name} – ∅ ${Number(finalStats.worstRecognizedWine.avgScore).toFixed(2)} Pkt` : '—'}
                </div>
                <div>
                  <span className="font-medium">Bestbewerteter Wein: </span>
                  {finalStats.bestRatedWine && finalStats.bestRatedWine.count > 0 ? `(${finalStats.bestRatedWine.letterCode}) ${finalStats.bestRatedWine.producer} ${finalStats.bestRatedWine.name} – ∅ ${Number(finalStats.bestRatedWine.avgRating).toFixed(2)} (${finalStats.bestRatedWine.count})` : '—'}
                </div>
                <div>
                  <span className="font-medium">Schlechtester Wein (Bewertung): </span>
                  {finalStats.worstRatedWine && finalStats.worstRatedWine.count > 0 ? `(${finalStats.worstRatedWine.letterCode}) ${finalStats.worstRatedWine.producer} ${finalStats.worstRatedWine.name} – ∅ ${Number(finalStats.worstRatedWine.avgRating).toFixed(2)} (${finalStats.worstRatedWine.count})` : '—'}
                </div>
              </CardContent>
            </Card>
          )}
          {isFlightsLoading ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#274E37]" />
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
                      <div className="text-sm text-muted-foreground flex justify-between items-center px-6 pt-1">
                        <span>{flight.wines?.length || 0} Weine</span>
                        {timeLeft !== null && timerFlightId === flight.id && (
                          <div className="flex items-center text-amber-600 font-medium">
                            <AlarmClock className="h-4 w-4 mr-1 animate-pulse" />
                            <span>
                              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <FlightWineList flight={flight} />

                      {isHost && !allFlightsCompleted && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddWine(flight.id)}
                            className="w-full"
                          >
                            Wein hinzufügen
                          </Button>
                          {tasting.status === 'started' && !flight.startedAt && (
                            <Button
                              size="sm"
                              onClick={() => handleStartFlight(flight.id)}
                              className="w-full bg-[#274E37] hover:bg-[#e65b2d]"
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
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10">
              <p className="text-gray-500 italic mb-4">Keine Flights für diese Verkostung</p>
            </div>
          )}
          {/* Dialog für Flight-Erstellung */}
          <CreateFlightDialog
            tastingId={tasting.id}
            open={createFlightDialogOpen}
            onOpenChange={setCreateFlightDialogOpen}
          />
          {isHost && !allFlightsCompleted && (
            <div className="flex justify-center mt-6">
              <Button
                className="bg-[#274E37] hover:bg-[#e65b2d]"
                onClick={() => setCreateFlightDialogOpen(true)}
              >
                {flights && flights.length > 0 ? 'Weiteren Flight hinzufügen' : 'Flight erstellen'}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="participants">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-[#274E37]" />
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
                      <UserIcon className="h-4 w-4 mr-2 text-gray-500" />
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
                                  ? 'bg-[#274E37] text-white' 
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
                                  ? 'bg-[#274E37] text-white' 
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
                                  ? 'bg-[#274E37] text-white' 
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
                                  ? 'bg-[#274E37] text-white' 
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
                                  ? 'bg-[#274E37] text-white' 
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
                                  ? 'bg-[#274E37] text-white' 
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
                                ? 'bg-[#274E37] text-white' 
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                            onClick={() => handleVarietalsModeChange('per')}
                          >
                            Punkte pro korrekte Rebsorte
                          </button>
                          <button
                            className={`px-4 py-2 rounded text-sm ${
                              pointsConfiguration.varietalsMode === 'all' 
                                ? 'bg-[#274E37] text-white' 
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
                                ? "bg-[#274E37] text-white"
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
                          className="w-full accent-[#274E37]"
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
                                      index === 2 ? 'bg-amber-700' : 'bg-[#274E37]'
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
                                      index === 2 ? 'bg-amber-700' : 'bg-[#274E37]'
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
      {selectedFlightId && (
        <>
          <AddWineDialog 
            flightId={selectedFlightId}
            open={addWineDialogOpen}
            onOpenChange={setAddWineDialogOpen}
            onWineAdded={handleWineAdded}
            refetchFlights={refetchFlights}
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
