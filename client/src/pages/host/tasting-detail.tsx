import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Loader2, Wine, Clock, AlarmClock, X, Users, Trophy, User as UserIcon, Share2, ClipboardList, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Leaderboard from "@/components/tasting/leaderboard";
import { ScoringRule } from "@shared/schema";

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
// CreateFlightDialog entfernt: Direktes Erstellen ohne Dialog

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

function FlightWineList({ flight, isHost }: { flight: Flight; isHost: boolean }) {
  const queryClient = useQueryClient();
  const deleteWineMutation = useMutation({
    mutationFn: async (wineId: number) => {
      const res = await apiRequest('DELETE', `/api/wines/${wineId}`);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/tastings/${flight.tastingId}/flights`] });
      await queryClient.invalidateQueries({ queryKey: ["flight-guess-stats", flight.id] });
    }
  });
  const { data: guessStats } = useQuery<FlightGuessStats>({
    queryKey: ["flight-guess-stats", flight.id],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/flights/${flight.id}/guess-stats`, { credentials: 'include' });
        if (!res.ok) return { flightId: flight.id, tastingId: flight.tastingId, stats: [] } as any;
        return res.json();
      } catch {
        return { flightId: flight.id, tastingId: flight.tastingId, stats: [] } as any;
      }
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
          <div key={wine.id} className="flex items-center justify-between p-2 rounded bg-gray-50 relative">
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
            {isHost && !flight.startedAt && !flight.completedAt && (
              <button
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center"
                title="Wein entfernen"
                onClick={() => {
                  if (confirm('Diesen Wein aus dem Flight entfernen?')) deleteWineMutation.mutate(wine.id);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
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
  // Per-varietal adjustments in participant dialog for 'anyVarietalPoint'
  const [varietalAdjustments, setVarietalAdjustments] = useState<Record<number, { add: Set<string>; remove: Set<string> }>>({});

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
            // Ranking/Teilnehmer aktualisieren
            queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/participants`] });
          } else if (data.type === 'scores_updated') {
            // Punkte wurden neu berechnet → Ranking aktualisieren
            queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/participants`] });
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
  // Dialog entfernt – wir erstellen Flights direkt per Klick
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

  // Review & Freigabe entfernt – manuelles Punktetoggeln erfolgt direkt im Teilnehmer-Dialog

  const overrideGuessMutation = useMutation({
    mutationFn: async ({ guessId, overrideScore, reason, overrideFlags }: { guessId: number; overrideScore: number; reason?: string; overrideFlags?: any }) => {
      const res = await apiRequest('PATCH', `/api/guesses/${guessId}/override`, { overrideScore, overrideReason: reason, overrideFlags });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Override fehlgeschlagen');
      }
      return res.json();
    },
    onSuccess: async (data: any) => {
      const delta = typeof data?.delta === 'number' ? data.delta : undefined;
      const pid = participantDialog.participant?.id;
      if (typeof delta === 'number' && pid) {
        queryClient.setQueryData([`/api/tastings/${tastingId}/participants`], (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((p: any) => p.id === pid ? { ...p, score: (p.score ?? 0) + delta } : p);
        });
      }
      await queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/participants`] });
      if (participantDialog.participant?.id) {
        await queryClient.invalidateQueries({ queryKey: ["/api/participants", participantDialog.participant.id, "guesses"] });
      }
      // also refresh stats and final results views
      await queryClient.invalidateQueries({ queryKey: ["/api/tastings", tastingId, "final-stats"] });
      if (lastCompletedFlight?.id) {
        await queryClient.invalidateQueries({ queryKey: ["/api/flights", lastCompletedFlight.id, "stats"] });
      }
    },
    onError: (e: Error) => {
      try {
        toast({ title: 'Fehler', description: e.message || 'Konnte Punkte nicht ändern', variant: 'destructive' });
      } catch {}
    }
  });

  // approveReview entfernt

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

  // Teilnehmer-Details (Weine vs. Tipps) – Modal (muss VOR jeglicher Rückgabe definiert sein)
  const [participantDialog, setParticipantDialog] = useState<{ open: boolean; participant: any | null }>({ open: false, participant: null });
  type Guess = { id: number; participantId: number; wineId: number; score: number; rating?: number | null; country?: string | null; region?: string | null; producer?: string | null; name?: string | null; vintage?: string | null; varietals?: string[] | null };
  const { data: participantGuesses } = useQuery<Guess[]>({
    queryKey: participantDialog.participant ? ["/api/participants", participantDialog.participant.id, "guesses"] : ["participant-guesses", "none"],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/participants/${participantDialog.participant!.id}/guesses`);
      if (!res.ok) throw new Error('Fehler beim Laden der Tipps');
      return res.json();
    },
    enabled: !!participantDialog.participant?.id && participantDialog.open,
  });

  // Scoring rules for field-level highlighting/toggling in participant dialog
  const { data: scoringRules } = useQuery<ScoringRule>({
    queryKey: [`/api/tastings/${tastingId}/scoring`],
  });

  // Helpers to compute automatic matches and scores per field
  type FieldKey = 'country'|'region'|'producer'|'name'|'vintage'|'varietals';
  const [guessAdjustments, setGuessAdjustments] = useState<Record<number, { add: Set<FieldKey>; remove: Set<FieldKey>; override: number }>>({});
  const [busyGuessIds, setBusyGuessIds] = useState<Set<number>>(new Set());
  const defaultScoring: ScoringRule = {
    id: 0,
    tastingId,
    country: 1,
    region: 1,
    producer: 1,
    wineName: 1,
    vintage: 1,
    varietals: 1,
    anyVarietalPoint: true,
    displayCount: 5,
  };
  const norm = (s?: string | null) => (s ?? '').toString().trim().toLowerCase();
  const eqTxt = (a?: string | null, b?: string | null) => norm(a) === norm(b);
  const eqVintage = (a?: string | null, b?: string | null) => {
    const aa = (a ?? '').toString().trim();
    const bb = (b ?? '').toString().trim();
    return aa === bb || Number(aa) === Number(bb);
  };
  const computeAuto = (g: Guess, wine: Wine, rules?: ScoringRule) => {
    const r = rules ?? defaultScoring;
    const fields = {
      country: !!(g.country && r.country > 0 && eqTxt(wine.country, g.country)),
      region: !!(g.region && r.region > 0 && eqTxt(wine.region, g.region)),
      producer: !!(g.producer && r.producer > 0 && eqTxt(wine.producer, g.producer)),
      name: !!(g.name && r.wineName > 0 && eqTxt(wine.name, g.name)),
      vintage: !!(g.vintage && r.vintage > 0 && eqVintage(wine.vintage, g.vintage)),
      varietals: false as boolean,
    };
    let varietalMatches: boolean[] = [];
    let varietalAutoPoints = 0;
    if (g.varietals && g.varietals.length && r.varietals > 0) {
      const wineVars = (wine.varietals || []).map(v => v.toLowerCase());
      const guessVars = (g.varietals || []).map(v => v.toLowerCase());
      varietalMatches = guessVars.map(v => wineVars.includes(v));
      if (r.anyVarietalPoint) {
        const matchedCount = varietalMatches.filter(Boolean).length;
        fields.varietals = matchedCount > 0;
        varietalAutoPoints = matchedCount * r.varietals;
      } else {
        const gw = guessVars.sort();
        const ww = wineVars.slice().sort();
        fields.varietals = gw.length === ww.length && gw.every((v, i) => v === ww[i]);
        varietalAutoPoints = fields.varietals ? r.varietals : 0;
      }
    }
    const autoScore =
      (fields.country ? r.country : 0) +
      (fields.region ? r.region : 0) +
      (fields.producer ? r.producer : 0) +
      (fields.name ? r.wineName : 0) +
      (fields.vintage ? r.vintage : 0) +
      varietalAutoPoints;
    return { fields, autoScore, varietalMatches };
  };
  const fieldPoint = (key: 'country'|'region'|'producer'|'name'|'vintage'|'varietals', rules?: ScoringRule) => {
    const r = rules ?? defaultScoring;
    switch (key) {
      case 'country': return r.country;
      case 'region': return r.region;
      case 'producer': return r.producer;
      case 'name': return r.wineName;
      case 'vintage': return r.vintage;
      case 'varietals': return r.varietals;
    }
  };

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

  // Flight direkt erstellen (ohne Dialog)
  const createFlightMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tastings/${tastingId}/flights`, {});
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: 'Flight erstellt' });
      await queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/flights`] });
    },
    onError: (e: Error) => {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    }
  });

  // Flight löschen
  const deleteFlightMutation = useMutation({
    mutationFn: async (flightId: number) => {
      const res = await apiRequest('DELETE', `/api/flights/${flightId}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Flight konnte nicht gelöscht werden');
      }
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: 'Flight entfernt' });
      await queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/flights`] });
    },
    onError: (e: Error) => {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
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

  // Werte für Dashboard-Kacheln
  const totalParticipants = (participants || []).filter(p => p.user?.id !== tasting.hostId).length;
  const totalFlights = (flights || []).length;
  const totalWines = (flights || []).reduce((acc, f) => acc + ((f as any).wines?.length || 0), 0);

  // Beitrittslink kopieren
  const copyJoinLink = () => {
    const joinLink = `${window.location.origin}/tasting/${tastingId}`;
    navigator.clipboard.writeText(joinLink);
    toast({ title: 'Beitrittslink kopiert', description: 'Der Link wurde in die Zwischenablage kopiert.' });
  };

  // Weinlabel inkl. Flight: (Flight N - Wein A)
  const formatWineLabel = (wineId?: number, letterCode?: string) => {
    try {
      if (!flights || !wineId) return letterCode ? `(Wein ${letterCode})` : '';
      for (const f of flights) {
        const w = (f as any).wines?.find((x: any) => x.id === wineId);
        if (w) return `(Flight ${Number(f.orderIndex) + 1} - Wein ${letterCode || w.letterCode})`;
      }
      return letterCode ? `(Wein ${letterCode})` : '';
    } catch { return letterCode ? `(Wein ${letterCode})` : ''; }
  };

  

  return (
    <div className="space-y-6">
      {/* Dashboard-Header */}
      <Card className="border border-primary/20 shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/90 p-6 text-white">
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{tasting.name}</h1>
              <p className="text-white/90 mt-1">
                Veranstaltet von {(tasting as any).hostName || participants?.find(p => p.user?.id === tasting.hostId)?.user?.name || 'Host'}
                {(() => {
                  const c = (tasting as any).hostCompany ?? participants?.find(p => p.user?.id === tasting.hostId)?.user?.company;
                  return c ? ` (${c})` : '';
                })()}
              </p>
            </div>
              <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center w-full sm:w-auto">
                <Badge className="self-start sm:self-auto" variant={allFlightsCompleted ? 'secondary' : tasting.status === 'active' ? 'default' : tasting.status === 'started' ? 'secondary' : 'outline'}>
                  {allFlightsCompleted ? 'Abgeschlossen' : tasting.status === 'active' ? 'Aktiv' : tasting.status === 'started' ? 'Gestartet' : 'Entwurf'}
                </Badge>
                <div className="text-white/90 text-sm -mt-1">
                  {`Teilnehmer ${totalParticipants} · Flights ${totalFlights} · Weine ${totalWines}`}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {!(allFlightsCompleted || tasting.status === 'completed') && (
                  <Button
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white w-full sm:w-auto"
                    onClick={copyJoinLink}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Beitrittslink kopieren
                  </Button>
                )}
                {!allFlightsCompleted && (
                  <>
                    {tasting.status === 'draft' && (
                      <Button className="bg-white text-primary hover:bg-white/90 w-full sm:w-auto" onClick={() => updateTastingStatus('active')}>
                        Verkostung veröffentlichen
                      </Button>
                    )}
                    {tasting.status === 'active' && (
                      <Button className="bg-white text-primary hover:bg-white/90 w-full sm:w-auto" onClick={() => updateTastingStatus('started')}>
                        Verkostung starten
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="flights" className="w-full">
        <div className="max-w-full rounded-2xl p-[1px] bg-[#e65b2d] mb-6">
          <div className="rounded-2xl bg-vinaturel-light">
            <TabsList className="!grid w-full grid-cols-3 min-h-[60px] pb-3 rounded-2xl overflow-visible outline-none bg-transparent" style={{ minHeight: '42px', paddingBottom: '8px' }}>
              <TabsTrigger 
                value="flights"
                className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
              >
                <ClipboardList className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Flights</span>
              </TabsTrigger>
              <TabsTrigger 
                value="participants"
                className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Teilnehmer</span>
                {participants && (
                  <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 py-0.5 rounded-full bg-vinaturel-original text-white text-xs font-medium">
                    {participants.filter(p => p.user?.id !== tasting?.hostId).length}
                  </span>
                )}
              </TabsTrigger>
              {/* Punktesystem in Einstellungen integriert */}
              {isHost && (
                <TabsTrigger 
                  value="settings"
                  className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
                >
                  <span className="truncate">Einstellungen</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>
        
        {/* Participants content moved lower with conditional rendering */}
        
        <TabsContent value="flights" className="space-y-6">
          {/* Review & Freigabe entfernt – Punktevergabe erfolgt direkt im Teilnehmer-Dialog */}

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
                  {lastCompletedStats.bestRecognizedWine ? `${formatWineLabel(lastCompletedStats.bestRecognizedWine.wineId, lastCompletedStats.bestRecognizedWine.letterCode)} ${lastCompletedStats.bestRecognizedWine.producer} ${lastCompletedStats.bestRecognizedWine.name} – ∅ ${Number(lastCompletedStats.bestRecognizedWine.avgScore).toFixed(2)} Pkt` : '—'}
                </div>
                <div>
                  <span className="font-medium">Am schlechtesten erkannt: </span>
                  {lastCompletedStats.worstRecognizedWine ? `${formatWineLabel(lastCompletedStats.worstRecognizedWine.wineId, lastCompletedStats.worstRecognizedWine.letterCode)} ${lastCompletedStats.worstRecognizedWine.producer} ${lastCompletedStats.worstRecognizedWine.name} – ∅ ${Number(lastCompletedStats.worstRecognizedWine.avgScore).toFixed(2)} Pkt` : '—'}
                </div>
                <div>
                  <span className="font-medium">Bestbewertet: </span>
                  {lastCompletedStats.bestRatedWine && lastCompletedStats.bestRatedWine.count > 0 ? `${formatWineLabel(lastCompletedStats.bestRatedWine.wineId, lastCompletedStats.bestRatedWine.letterCode)} ${lastCompletedStats.bestRatedWine.producer} ${lastCompletedStats.bestRatedWine.name} – ∅ ${Number(lastCompletedStats.bestRatedWine.avgRating).toFixed(2)} (${lastCompletedStats.bestRatedWine.count})` : '—'}
                </div>
                <div>
                  <span className="font-medium">Schlecht bewertet: </span>
                  {lastCompletedStats.worstRatedWine && lastCompletedStats.worstRatedWine.count > 0 ? `${formatWineLabel(lastCompletedStats.worstRatedWine.wineId, lastCompletedStats.worstRatedWine.letterCode)} ${lastCompletedStats.worstRatedWine.producer} ${lastCompletedStats.worstRatedWine.name} – ∅ ${Number(lastCompletedStats.worstRatedWine.avgRating).toFixed(2)} (${lastCompletedStats.worstRatedWine.count})` : '—'}
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
                  {finalStats.bestRecognizedWine ? `${formatWineLabel(finalStats.bestRecognizedWine.wineId, finalStats.bestRecognizedWine.letterCode)} ${finalStats.bestRecognizedWine.producer} ${finalStats.bestRecognizedWine.name} – ∅ ${Number(finalStats.bestRecognizedWine.avgScore).toFixed(2)} Pkt` : '—'}
                </div>
                <div>
                  <span className="font-medium">Am schlechtesten erkannt (gesamt): </span>
                  {finalStats.worstRecognizedWine ? `${formatWineLabel(finalStats.worstRecognizedWine.wineId, finalStats.worstRecognizedWine.letterCode)} ${finalStats.worstRecognizedWine.producer} ${finalStats.worstRecognizedWine.name} – ∅ ${Number(finalStats.worstRecognizedWine.avgScore).toFixed(2)} Pkt` : '—'}
                </div>
                <div>
                  <span className="font-medium">Bestbewerteter Wein: </span>
                  {finalStats.bestRatedWine && finalStats.bestRatedWine.count > 0 ? `${formatWineLabel(finalStats.bestRatedWine.wineId, finalStats.bestRatedWine.letterCode)} ${finalStats.bestRatedWine.producer} ${finalStats.bestRatedWine.name} – ∅ ${Number(finalStats.bestRatedWine.avgRating).toFixed(2)} (${finalStats.bestRatedWine.count})` : '—'}
                </div>
                <div>
                  <span className="font-medium">Schlechtester Wein (Bewertung): </span>
                  {finalStats.worstRatedWine && finalStats.worstRatedWine.count > 0 ? `${formatWineLabel(finalStats.worstRatedWine.wineId, finalStats.worstRatedWine.letterCode)} ${finalStats.worstRatedWine.producer} ${finalStats.worstRatedWine.name} – ∅ ${Number(finalStats.worstRatedWine.avgRating).toFixed(2)} (${finalStats.worstRatedWine.count})` : '—'}
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
                        <div className="flex items-center gap-2">
                          <Badge variant={flight.completedAt ? 'secondary' : flight.startedAt ? 'default' : 'outline'}>
                            {flight.completedAt ? 'Abgeschlossen' : flight.startedAt ? 'Im Gange' : 'Nicht gestartet'}
                          </Badge>
                          {isHost && !flight.startedAt && !flight.completedAt && (
                            <button
                              className="h-6 w-6 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center"
                              title="Flight entfernen"
                              onClick={() => deleteFlightMutation.mutate(flight.id)}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
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
                      <FlightWineList flight={flight} isHost={isHost} />

                      {isHost && !allFlightsCompleted && (
                        <div className="flex gap-2 mt-4">
                          {!flight.startedAt && !flight.completedAt && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddWine(flight.id)}
                              className="w-full"
                            >
                              Wein hinzufügen
                            </Button>
                          )}
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
                                className="w-1/2 bg-[#274E37] hover:bg-[#1E3E2B]"
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
          {isHost && !allFlightsCompleted && (
            <div className="flex justify-center mt-6">
              <Button
                className="bg-[#274E37] hover:bg-[#e65b2d]"
                onClick={() => createFlightMutation.mutate()}
                disabled={createFlightMutation.isPending}
              >
                {createFlightMutation.isPending ? 'Erstelle…' : (flights && flights.length > 0 ? 'Weiteren Flight hinzufügen' : 'Flight erstellen')}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="participants" className="space-y-6">
          {(tasting.status === 'draft' || tasting.status === 'active') ? (
            <Card>
              <CardHeader>
                <CardTitle>Teilnehmer verwalten</CardTitle>
                <CardDescription>
                  Hier verwaltest du Einladungen und Teilnehmer dieser Verkostung.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isHost && (
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
                      .filter(p => p.user?.id !== tasting.hostId)
                      .map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                              {p.user?.profileImage ? (
                                <img src={p.user.profileImage} alt={p.user?.name || 'Avatar'} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-sm text-gray-600">{(p.user?.name || '?').slice(0,1)}</span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{p.user?.name || 'Unbekannt'}</div>
                              <div className="text-xs text-gray-500">{p.user?.company || '—'}</div>
                            </div>
                          </div>
                          {isHost && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleRemoveParticipant(p.userId)}
                              title="Teilnehmer entfernen"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
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
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Teilnehmer‑Ranking</CardTitle>
                <CardDescription>Gesamtpunktestand der Teilnehmer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {participants && participants.length > 0 ? (
                  [...participants]
                    .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
                    .map((p: any, idx: number) => {
                      const rank = idx + 1;
                      const badgeColor = rank === 1 ? 'bg-yellow-500' : rank === 2 ? 'bg-gray-400' : rank === 3 ? 'bg-amber-700' : 'bg-gray-300';
                      const ptsColor = rank === 1 ? 'bg-yellow-500' : rank === 2 ? 'bg-gray-400' : rank === 3 ? 'bg-amber-700' : 'bg-gray-200';
                      return (
                        <div
                          key={p.id}
                          className="p-3 rounded-md border flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                          onClick={() => setParticipantDialog({ open: true, participant: p })}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                                {p.user?.profileImage ? (
                                  <img src={p.user.profileImage} alt={p.user?.name || 'Avatar'} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-sm text-gray-600">{(p.user?.name || '?').slice(0,1)}</span>
                                )}
                              </div>
                              {rank <= 3 && (
                                <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border border-white ${badgeColor}`}></span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{p.user?.name || 'Unbekannt'}</div>
                              <div className="text-xs text-gray-500">{p.user?.company || '—'}</div>
                            </div>
                          </div>
                          <div>
                            <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${ptsColor}`}>{p.score ?? 0} Pkt</span>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="text-sm text-gray-500">Keine Teilnehmer</div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Scoring-Tab entfernt – Scoring ist in Einstellungen integriert */}

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
                  {/* Punktesystem (aus ehemaligem Tab) */}
                  <div>
                    <h3 className="text-lg font-medium mb-2">Punktesystem</h3>
                    <p className="text-sm text-gray-500 mb-4">Legen Sie fest, wie viele Punkte für korrekt identifizierte Weinmerkmale vergeben werden (0-5 Punkte)</p>
                    {isHost ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Produzent:</label>
                            <div className="flex items-center space-x-2">
                              {[0, 1, 2, 3, 4, 5].map((value) => (
                                <button key={value} className={`w-10 h-10 rounded-full ${pointsConfiguration.producer === value ? 'bg-[#274E37] text-white' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => handlePointsChange('producer', value)}>{value}</button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Name:</label>
                            <div className="flex items-center space-x-2">
                              {[0, 1, 2, 3, 4, 5].map((value) => (
                                <button key={value} className={`w-10 h-10 rounded-full ${pointsConfiguration.name === value ? 'bg-[#274E37] text-white' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => handlePointsChange('name', value)}>{value}</button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Jahrgang:</label>
                            <div className="flex items-center space-x-2">
                              {[0, 1, 2, 3, 4, 5].map((value) => (
                                <button key={value} className={`w-10 h-10 rounded-full ${pointsConfiguration.vintage === value ? 'bg-[#274E37] text-white' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => handlePointsChange('vintage', value)}>{value}</button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Land:</label>
                            <div className="flex items-center space-x-2">
                              {[0, 1, 2, 3, 4, 5].map((value) => (
                                <button key={value} className={`w-10 h-10 rounded-full ${pointsConfiguration.country === value ? 'bg-[#274E37] text-white' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => handlePointsChange('country', value)}>{value}</button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Region:</label>
                            <div className="flex items-center space-x-2">
                              {[0, 1, 2, 3, 4, 5].map((value) => (
                                <button key={value} className={`w-10 h-10 rounded-full ${pointsConfiguration.region === value ? 'bg-[#274E37] text-white' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => handlePointsChange('region', value)}>{value}</button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Rebsorten:</label>
                            <div className="flex items-center space-x-2">
                              {[0, 1, 2, 3, 4, 5].map((value) => (
                                <button key={value} className={`w-10 h-10 rounded-full ${pointsConfiguration.varietals === value ? 'bg-[#274E37] text-white' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => handleVarietalsChange(value)}>{value}</button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Rebsorten‑Wertung:</label>
                            <div className="flex flex-col gap-2">
                              <button className={`px-4 py-2 rounded text-sm ${pointsConfiguration.varietalsMode === 'per' ? 'bg-[#274E37] text-white' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => handleVarietalsModeChange('per')}>Punkte pro korrekte Rebsorte</button>
                              <button className={`px-4 py-2 rounded text-sm ${pointsConfiguration.varietalsMode === 'all' ? 'bg-[#274E37] text-white' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => handleVarietalsModeChange('all')}>Punkte nur wenn alle Rebsorten korrekt</button>
                            </div>
                          </div>
                        </div>
                        <div className="pt-4 border-t">
                          <div className="text-lg font-medium">Maximale Punktzahl pro Wein: {Object.entries(pointsConfiguration).filter(([k]) => k !== 'varietalsMode').map(([_, v]) => typeof v === 'number' ? v : 0).reduce((s, v) => s + v, 0)}</div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Punktesystem wird vom Host festgelegt.</p>
                    )}
                  </div>
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

      {/* Teilnehmer-Detail-Dialog: Weine vs. Tipps */}
      <Dialog open={participantDialog.open} onOpenChange={(o) => setParticipantDialog(s => ({ ...s, open: o }))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tipps von {participantDialog.participant?.user?.name || participantDialog.participant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 max-h-[70vh] overflow-auto pr-1">
            {flights?.map((f) => (
              <div key={f.id}>
                <h3 className="text-base font-semibold text-gray-800 mb-2">{f.name}</h3>
                <div className="space-y-3">
                  {(f.wines || []).map((wine: any) => {
                    const g = participantGuesses?.find((x: any) => x.wineId === wine.id);
                    return (
                      <div key={wine.id} className="p-3 rounded border bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="h-7 w-7 mr-2 flex items-center justify-center rounded-full bg-[#274E37] text-white">
                              {wine.letterCode}
                            </span>
                            <div>
                              <div className="font-medium">{wine.producer} {wine.name}</div>
                              <div className="text-xs text-gray-600">{wine.region}, {wine.country}, {wine.vintage}</div>
                            </div>
                          </div>
                          <Badge className="bg-[#274E37]">
                            {(() => {
                              if (!g) return '0 Pkt';
                              const r = scoringRules ?? defaultScoring;
                              const auto = computeAuto(g as any, wine, r);
                              const adj = guessAdjustments[g.id];
                              const isActive = (key: FieldKey) => {
                                const base = (auto.fields as any)[key] === true;
                                if (adj) {
                                  if (base && adj.remove.has(key)) return false;
                                  if (!base && adj.add.has(key)) return true;
                                }
                                return base;
                              };
                              const baseOther = (isActive('country') ? r.country : 0)
                                + (isActive('region') ? r.region : 0)
                                + (isActive('producer') ? r.producer : 0)
                                + (isActive('name') ? r.wineName : 0)
                                + (isActive('vintage') ? r.vintage : 0);
                              if (r.anyVarietalPoint) {
                                const baseMatches = auto.varietalMatches || [];
                                const curr = varietalAdjustments[g.id];
                                const add = curr?.add || new Set<string>();
                                const remove = curr?.remove || new Set<string>();
                                const guessVarsOrig = g.varietals || [];
                                const activeCount = guessVarsOrig.reduce((acc, v, i) => {
                                  const base = !!baseMatches[i];
                                  if (base && remove.has(v)) return acc;
                                  if (!base && add.has(v)) return acc + 1;
                                  return acc + (base ? 1 : 0);
                                }, 0);
                                return `${baseOther + activeCount * r.varietals} Pkt`;
                              }
                              const varietalsOn = isActive('varietals') ? r.varietals : 0;
                              return `${baseOther + varietalsOn} Pkt`;
                            })()}
                          </Badge>
                        </div>
                        <div className="mt-2 text-sm text-gray-700">
                          <div className="font-medium">Tipp des Teilnehmers</div>
                          {g ? (
                            (() => {
                              const r = scoringRules ?? defaultScoring;
                              const auto = computeAuto(g, wine, r);
                              const adj = guessAdjustments[g.id];
                              const isActive = (key: FieldKey) => {
                                const base = (auto.fields as any)[key] === true;
                                if (adj) {
                                  if (base && adj.remove.has(key)) return false;
                                  if (!base && adj.add.has(key)) return true;
                                }
                                return base;
                              };
                              const chip = (label: string, active: boolean, onClick: () => void, points: number) => {
                                if (!points) {
                                  return (
                                    <span className="text-xs mr-2 mb-2 inline-flex items-center px-2 py-1 rounded border bg-gray-100 border-gray-300 text-gray-500 cursor-default">
                                      {label}
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
                                    className={`text-xs mr-2 mb-2 inline-flex items-center px-2 py-1 rounded border ${active ? 'bg-green-100 border-green-300 text-green-800' : 'bg-orange-100 border-orange-300 text-orange-800'}`}
                                    title={active ? 'Punkt entfernen' : 'Punkt vergeben'}
                                  >
                                    {label}
                                  </button>
                                );
                              };
                              const toggle = (key: 'country'|'region'|'producer'|'name'|'vintage'|'varietals') => {
                                const r = scoringRules ?? defaultScoring;
                                if (!g || busyGuessIds.has(g.id)) return;
                                const { autoScore, fields } = computeAuto(g, wine, r);
                                const p = fieldPoint(key, r);
                                if (!p) return;
                                const currentAdj = guessAdjustments[g.id] || { add: new Set<FieldKey>(), remove: new Set<FieldKey>(), override: (g.score ?? 0) - autoScore };
                                const add = new Set<FieldKey>(currentAdj.add);
                                const remove = new Set<FieldKey>(currentAdj.remove);
                                const isAuto = (fields as any)[key] === true;
                                if (isAuto) {
                                  if (remove.has(key)) remove.delete(key); else remove.add(key);
                                } else {
                                  if (add.has(key)) add.delete(key); else add.add(key);
                                }
                                const active = (k: FieldKey) => {
                                  const base = (fields as any)[k] === true;
                                  if (base && remove.has(k)) return false;
                                  if (!base && add.has(k)) return true;
                                  return base;
                                };
                                const desired = (active('country') ? r.country : 0)
                                              + (active('region') ? r.region : 0)
                                              + (active('producer') ? r.producer : 0)
                                              + (active('name') ? r.wineName : 0)
                                              + (active('vintage') ? r.vintage : 0)
                                              + (active('varietals') ? r.varietals : 0);
                                const newOverride = Math.max(0, desired) - autoScore;
                                setGuessAdjustments(prev => ({ ...prev, [g.id]: { add, remove, override: newOverride } }));
                                setBusyGuessIds(prev => new Set(prev).add(g.id));
                                const overrideFlags = { add: Array.from(add), remove: Array.from(remove), varietalAdd: [], varietalRemove: [] };
                                overrideGuessMutation.mutate({ guessId: g.id, overrideScore: newOverride, overrideFlags }, {
                                  onSettled: () => {
                                    setBusyGuessIds(prev => { const next = new Set(prev); next.delete(g.id); return next; });
                                  },
                                });
                              };
                              return (
                                <div className="flex flex-wrap">
                                  {chip(g.country || '-', isActive('country'), () => toggle('country'), r.country)}
                                  {chip(g.region || '-', isActive('region'), () => toggle('region'), r.region)}
                                  {chip(g.producer || '-', isActive('producer'), () => toggle('producer'), r.producer)}
                                  {chip(g.name || '-', isActive('name'), () => toggle('name'), r.wineName)}
                                  {chip(g.vintage || '-', isActive('vintage'), () => toggle('vintage'), r.vintage)}
                                  {(r.anyVarietalPoint
                                    ? ((g.varietals || []).map((v: string, i: number) => {
                                        const base = !!(auto.varietalMatches || [])[i];
                                        const curr = varietalAdjustments[g.id];
                                        const add = curr?.add || new Set<string>();
                                        const remove = curr?.remove || new Set<string>();
                                        const active = (base && !remove.has(v)) || (!base && add.has(v));
                                        return chip(v, active, () => {
                                          if (!g || busyGuessIds.has(g.id)) return;
                                          const r = scoringRules ?? defaultScoring;
                                          if (!r.varietals || !r.anyVarietalPoint) return;
                                          const a = computeAuto(g, wine, r);
                                          const curr2 = varietalAdjustments[g.id] || { add: new Set<string>(), remove: new Set<string>() };
                                          const add2 = new Set(curr2.add);
                                          const remove2 = new Set(curr2.remove);
                                          if (base) { if (remove2.has(v)) remove2.delete(v); else remove2.add(v); }
                                          else { if (add2.has(v)) add2.delete(v); else add2.add(v); }
                                          const guessVarsOrig = g.varietals || [];
                                          const desiredCount = guessVarsOrig.reduce((acc, vv, ii) => {
                                            const b = !!(a.varietalMatches || [])[ii];
                                            if (b && remove2.has(vv)) return acc;
                                            if (!b && add2.has(vv)) return acc + 1;
                                            return acc + (b ? 1 : 0);
                                          }, 0);
                                          const basePointsOther = a.autoScore - ((a.varietalMatches || []).filter(Boolean).length * r.varietals);
                                          const desiredTotal = basePointsOther + desiredCount * r.varietals;
                                          const newOverride = Math.max(0, desiredTotal - a.autoScore);
                                          setVarietalAdjustments(prev => ({ ...prev, [g.id]: { add: add2, remove: remove2 } }));
                                          setBusyGuessIds(prev => new Set(prev).add(g.id));
                                          const fieldAdj = guessAdjustments[g.id];
                                          const overrideFlags = {
                                            add: fieldAdj ? Array.from(fieldAdj.add) : [],
                                            remove: fieldAdj ? Array.from(fieldAdj.remove) : [],
                                            varietalAdd: Array.from(add2),
                                            varietalRemove: Array.from(remove2),
                                          };
                                          overrideGuessMutation.mutate({ guessId: g.id, overrideScore: newOverride, overrideFlags }, {
                                            onSettled: () => {
                                              setBusyGuessIds(prev => { const next = new Set(prev); next.delete(g.id); return next; });
                                            },
                                          });
                                        }, r.varietals);
                                      }))
                                    : chip(g.varietals && g.varietals.length ? g.varietals.join(', ') : '-', isActive('varietals'), () => toggle('varietals'), r.varietals)
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <div className="text-xs text-gray-500">Kein Tipp abgegeben</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
