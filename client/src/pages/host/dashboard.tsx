import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Share2, Users, Wine, ClipboardList, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import FlightStatus from '@/components/tasting/flight-status';
import Leaderboard from "@/components/tasting/leaderboard";
import { ScoringRule } from "@shared/schema";
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
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<string>("current");
  const [selectedFlightIndex, setSelectedFlightIndex] = useState(0);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  // Scoring rules werden per Query geladen
  
  const { user } = useAuth();
  
  const { data: tasting, isLoading: tastingLoading } = useQuery({
    queryKey: ['tasting', tastingId],
    queryFn: async (): Promise<Tasting> => {
      const response = await fetch(`/api/tastings/${tastingId}`, { credentials: 'include' });
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
      const response = await fetch(`/api/tastings/${tastingId}/flights`, { credentials: 'include' });
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

  const { data: scoringRules } = useQuery<ScoringRule>({
    queryKey: ['scoringRules', tastingId],
    queryFn: async () => {
      const response = await fetch(`/api/tastings/${tastingId}/scoring`, { credentials: 'include' });
      if (!response.ok) throw new Error('Fehler beim Laden der Bewertungsregeln');
      return response.json();
    },
    enabled: !!tastingId,
  });

  // Derived flags
  const allFlightsCompleted = useMemo(() => {
    if (!Array.isArray(flights) || flights.length === 0) {
      return false;
    }
    return flights.every(flight => Boolean(flight.completedAt));
  }, [flights]);

  // Per-flight stats (only when selected flight is completed)
  const { data: flightStats } = useQuery<any>({
    queryKey: selectedFlight?.id ? ["/api/flights", selectedFlight.id, "stats"] : ["flight-stats", "none"],
    queryFn: async () => {
      const res = await fetch(`/api/flights/${selectedFlight!.id}/stats`, { credentials: 'include' });
      if (!res.ok) throw new Error('Fehler beim Laden der Flight-Statistiken');
      return res.json();
    },
    enabled: !!selectedFlight?.id && !!selectedFlight?.completedAt,
  });

  // Final stats when all flights are completed
  const { data: finalStats } = useQuery<any>({
    queryKey: allFlightsCompleted ? ["/api/tastings", tastingId, "final-stats"] : ["final-stats", "none"],
    queryFn: async () => {
      const res = await fetch(`/api/tastings/${tastingId}/final-stats`, { credentials: 'include' });
      if (!res.ok) throw new Error('Fehler beim Laden der Endergebnis-Statistiken');
      return res.json();
    },
    enabled: Boolean(tastingId && allFlightsCompleted),
  });

  // Participant detail modal state
  const [participantDialog, setParticipantDialog] = useState<{ open: boolean; participant: any | null }>({ open: false, participant: null });
  type Guess = { id: number; participantId: number; wineId: number; score: number; rating?: number | null; country?: string | null; region?: string | null; producer?: string | null; name?: string | null; vintage?: string | null; varietals?: string[] | null };
  const { data: participantGuesses } = useQuery<Guess[]>({
    queryKey: participantDialog.participant ? ["/api/participants", participantDialog.participant.id, "guesses"] : ["participant-guesses", "none"],
    queryFn: async () => {
      const res = await fetch(`/api/participants/${participantDialog.participant!.id}/guesses`, { credentials: 'include' });
      if (!res.ok) throw new Error('Fehler beim Laden der Tipps');
      return res.json();
    },
    enabled: !!participantDialog.participant?.id && participantDialog.open,
  });

  // Local UI adjustments per guess: which fields were manually added or removed
  type FieldKey = 'country'|'region'|'producer'|'name'|'vintage'|'varietals';
  const [guessAdjustments, setGuessAdjustments] = useState<Record<number, { add: Set<FieldKey>; remove: Set<FieldKey>; override: number }>>({});
  // Per-varietal adjustments for 'anyVarietalPoint' mode
  const [varietalAdjustments, setVarietalAdjustments] = useState<Record<number, { add: Set<string>; remove: Set<string> }>>({});
  const [busyGuessIds, setBusyGuessIds] = useState<Set<number>>(new Set());

  // Helpers to compute auto scoring per field
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
  const handleToggle = async (g: Guess | undefined, wine: Wine, key: FieldKey) => {
    if (!g) return;
    if (busyGuessIds.has(g.id)) return; // prevent concurrent updates per guess
    const r = scoringRules ?? defaultScoring;
    const { fields, autoScore } = computeAuto(g, wine, r);
    const p = fieldPoint(key, r);
    if (!p) return; // nothing to toggle
    const currentAdj = guessAdjustments[g.id] || { add: new Set<FieldKey>(), remove: new Set<FieldKey>(), override: (g.score ?? 0) - autoScore };
    const add = new Set<FieldKey>(currentAdj.add);
    const remove = new Set<FieldKey>(currentAdj.remove);
    const isAuto = (fields as any)[key] === true;
    // flip state locally first
    if (isAuto) { if (remove.has(key)) remove.delete(key); else remove.add(key); }
    else { if (add.has(key)) add.delete(key); else add.add(key); }
    // compute desired score from active state
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
    try {
      // Include overrideFlags so other views can color chips consistently
      const vf = varietalAdjustments[g.id];
      const overrideFlags = {
        add: Array.from(add),
        remove: Array.from(remove),
        varietalAdd: vf ? Array.from(vf.add) : [],
        varietalRemove: vf ? Array.from(vf.remove) : [],
      };
      const res = await apiRequest('PATCH', `/api/guesses/${g.id}/override`, { overrideScore: newOverride, overrideFlags });
      if (!res.ok) throw new Error('Override fehlgeschlagen');
      await queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/participants`] });
      await queryClient.invalidateQueries({ queryKey: participantDialog.participant ? ["/api/participants", participantDialog.participant.id, "guesses"] : ["participant-guesses", "none"] });
      if (selectedFlight?.id) {
        await queryClient.invalidateQueries({ queryKey: ["/api/flights", selectedFlight.id, "stats"] });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/tastings", tastingId, "final-stats"] });
    } catch (e) {
      console.error(e);
      try {
        // @ts-ignore
        toast({ title: 'Fehler', description: 'Konnte Punkte nicht ändern', variant: 'destructive' });
      } catch {}
    } finally {
      setBusyGuessIds(prev => { const next = new Set(prev); next.delete(g.id); return next; });
    }
  };

  // Toggle for single varietal chip in 'anyVarietalPoint' mode
  const handleToggleVarietal = async (g: Guess | undefined, wine: Wine, varietalLabel: string) => {
    if (!g) return;
    if (busyGuessIds.has(g.id)) return;
    const r = scoringRules ?? defaultScoring;
    if (!r.varietals || !r.anyVarietalPoint) return;
    const auto = computeAuto(g, wine, r);
    const baseMatches = auto.varietalMatches || [];
    const guessVarsOrig = g.varietals || [];
    const idx = guessVarsOrig.findIndex(v => v.toLowerCase() === varietalLabel.toLowerCase());
    if (idx === -1) return; // not a guessed varietal
    const curr = varietalAdjustments[g.id] || { add: new Set<string>(), remove: new Set<string>() };
    const add = new Set(curr.add);
    const remove = new Set(curr.remove);
    const baseActive = !!baseMatches[idx];
    if (baseActive) { if (remove.has(varietalLabel)) remove.delete(varietalLabel); else remove.add(varietalLabel); }
    else { if (add.has(varietalLabel)) add.delete(varietalLabel); else add.add(varietalLabel); }
    // compute new desired varietal count
    const desiredCount = guessVarsOrig.reduce((acc, v, i) => {
      const base = !!baseMatches[i];
      const label = v;
      if (base && remove.has(label)) return acc; // switched off
      if (!base && add.has(label)) return acc + 1; // switched on
      return acc + (base ? 1 : 0);
    }, 0);
    const basePointsOtherFields = auto.autoScore - (baseMatches.filter(Boolean).length * r.varietals);
    const desiredTotal = basePointsOtherFields + desiredCount * r.varietals;
    const newOverride = Math.max(0, desiredTotal - auto.autoScore);
    setVarietalAdjustments(prev => ({ ...prev, [g.id]: { add, remove } }));
    setBusyGuessIds(prev => new Set(prev).add(g.id));
    try {
      const fieldAdj = guessAdjustments[g.id];
      const overrideFlags = {
        add: fieldAdj ? Array.from(fieldAdj.add) : [],
        remove: fieldAdj ? Array.from(fieldAdj.remove) : [],
        varietalAdd: Array.from(add),
        varietalRemove: Array.from(remove),
      };
      const res = await apiRequest('PATCH', `/api/guesses/${g.id}/override`, { overrideScore: newOverride, overrideFlags });
      if (!res.ok) throw new Error('Override fehlgeschlagen');
      await queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/participants`] });
      await queryClient.invalidateQueries({ queryKey: participantDialog.participant ? ["/api/participants", participantDialog.participant.id, "guesses"] : ["participant-guesses", "none"] });
      if (selectedFlight?.id) {
        await queryClient.invalidateQueries({ queryKey: ["/api/flights", selectedFlight.id, "stats"] });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/tastings", tastingId, "final-stats"] });
    } catch (e) {
      console.error(e);
      try { /* @ts-ignore */ toast({ title: 'Fehler', description: 'Konnte Punkte nicht ändern', variant: 'destructive' }); } catch {}
    } finally {
      setBusyGuessIds(prev => { const next = new Set(prev); next.delete(g.id); return next; });
    }
  };

  // Latest completed flight stats for intermediate results (if not all completed)
  const lastCompletedFlight = useMemo(() => {
    const completed = (flights || []).filter(f => !!f.completedAt);
    if (completed.length === 0) return null;
    // latest by completedAt
    completed.sort((a, b) => new Date(b.completedAt as any).getTime() - new Date(a.completedAt as any).getTime());
    return completed[0];
  }, [flights]);
  const { data: lastCompletedStats } = useQuery<any>({
    queryKey: lastCompletedFlight?.id ? ["/api/flights", lastCompletedFlight.id, "stats", "latest"] : ["latest-flight-stats", "none"],
    queryFn: async () => {
      const res = await fetch(`/api/flights/${lastCompletedFlight!.id}/stats`, { credentials: 'include' });
      if (!res.ok) throw new Error('Fehler beim Laden der Zwischenergebnisse');
      return res.json();
    },
    enabled: !!lastCompletedFlight?.id && !allFlightsCompleted,
    refetchOnWindowFocus: true,
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
  if (!user || tasting.hostId !== user?.id) {
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
    const computedStatus = allFlightsCompleted ? 'completed' : tasting.status;
    switch (computedStatus) {
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
                      {allFlightsCompleted ? 'Abgeschlossen' : (tasting.status.charAt(0).toUpperCase() + tasting.status.slice(1))}
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
                <div className="max-w-full rounded-2xl p-[1px] bg-[#e65b2d]">
                  <div className="rounded-2xl bg-vinaturel-light">
                    <TabsList className="!grid w-full grid-cols-3 min-h-[60px] pb-3 rounded-2xl overflow-visible outline-none bg-transparent" style={{ minHeight: '42px', paddingBottom: '8px' }}>
                      <TabsTrigger 
                        value="current"
                        className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
                      >
                        <ClipboardList className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Aktueller Flight</span>
                      </TabsTrigger>
                      <TabsTrigger 
                        value="leaderboard"
                        className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
                      >
                        <Users className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Bestenliste</span>
                        {tasting?.participants?.length ? (
                          <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 py-0.5 rounded-full bg-vinaturel-original text-white text-xs font-medium">
                            {tasting.participants.length}
                          </span>
                        ) : null}
                      </TabsTrigger>
                      <TabsTrigger 
                        value="wines"
                        className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-vinaturel-original data-[state=active]:font-medium rounded-md py-2 px-3 transition-colors text-vinaturel-original"
                      >
                        <Wine className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Weine</span>
                        {selectedFlight?.wines?.length ? (
                          <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 py-0.5 rounded-full bg-vinaturel-original text-white text-xs font-medium">
                            {selectedFlight.wines.length}
                          </span>
                        ) : null}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

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
                        {selectedFlight.completedAt && flightStats && (
                          <Card className="border border-gray-100 shadow-sm">
                            <CardHeader>
                              <CardTitle>Zwischenergebnis-Statistiken (Flight)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                              <div>
                                <span className="font-medium">Bester Verkoster dieses Flights: </span>
                                {flightStats.topScorer ? `${flightStats.topScorer.userName} (${flightStats.topScorer.score} Pkt)` : '—'}
                              </div>
                              <div>
                                <span className="font-medium">Am besten erkannt: </span>
                                {flightStats.bestRecognizedWine ? `(${flightStats.bestRecognizedWine.letterCode}) ${flightStats.bestRecognizedWine.producer} ${flightStats.bestRecognizedWine.name} – ∅ ${flightStats.bestRecognizedWine.avgScore.toFixed(2)} Pkt` : '—'}
                              </div>
                              <div>
                                <span className="font-medium">Am schlechtesten erkannt: </span>
                                {flightStats.worstRecognizedWine ? `(${flightStats.worstRecognizedWine.letterCode}) ${flightStats.worstRecognizedWine.producer} ${flightStats.worstRecognizedWine.name} – ∅ ${flightStats.worstRecognizedWine.avgScore.toFixed(2)} Pkt` : '—'}
                              </div>
                              <div>
                                <span className="font-medium">Bestbewerteter Wein: </span>
                                {flightStats.bestRatedWine && flightStats.bestRatedWine.count > 0 ? `(${flightStats.bestRatedWine.letterCode}) ${flightStats.bestRatedWine.producer} ${flightStats.bestRatedWine.name} – ∅ ${Number(flightStats.bestRatedWine.avgRating).toFixed(2)} (${flightStats.bestRatedWine.count})` : '—'}
                              </div>
                              <div>
                                <span className="font-medium">Schlechtester Wein (Bewertung): </span>
                                {flightStats.worstRatedWine && flightStats.worstRatedWine.count > 0 ? `(${flightStats.worstRatedWine.letterCode}) ${flightStats.worstRatedWine.producer} ${flightStats.worstRatedWine.name} – ∅ ${Number(flightStats.worstRatedWine.avgRating).toFixed(2)} (${flightStats.worstRatedWine.count})` : '—'}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="leaderboard" className="space-y-4">
                    <Leaderboard 
                      tastingId={tastingId} 
                      displayCount={null}
                      currentUserId={user.id}
                      onSelectParticipant={(p) => setParticipantDialog({ open: true, participant: p })}
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
                  displayCount={null}
                  currentUserId={user.id}
                  onSelectParticipant={(p) => setParticipantDialog({ open: true, participant: p })}
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
            {allFlightsCompleted && finalStats && (
              <Card className="border border-gray-100 shadow-sm">
                <CardHeader className="bg-gray-50 p-4 border-b border-gray-100">
                  <h2 className="font-medium text-gray-900">Endergebnis-Statistiken</h2>
                </CardHeader>
                <CardContent className="p-4 space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Am besten erkannt (gesamt): </span>
                    {finalStats.bestRecognizedWine ? `(${finalStats.bestRecognizedWine.letterCode}) ${finalStats.bestRecognizedWine.producer} ${finalStats.bestRecognizedWine.name} – ∅ ${finalStats.bestRecognizedWine.avgScore.toFixed(2)} Pkt` : '—'}
                  </div>
                  <div>
                    <span className="font-medium">Am schlechtesten erkannt (gesamt): </span>
                    {finalStats.worstRecognizedWine ? `(${finalStats.worstRecognizedWine.letterCode}) ${finalStats.worstRecognizedWine.producer} ${finalStats.worstRecognizedWine.name} – ∅ ${finalStats.worstRecognizedWine.avgScore.toFixed(2)} Pkt` : '—'}
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

            {/* Zwischenergebnis-Statistik (letzter abgeschlossener Flight) */}
            {!allFlightsCompleted && lastCompletedFlight && lastCompletedStats && (
              <Card className="border border-gray-100 shadow-sm">
                <CardHeader className="bg-gray-50 p-4 border-b border-gray-100">
                  <h2 className="font-medium text-gray-900">
                    Zwischenergebnis – {lastCompletedFlight.name}
                  </h2>
                </CardHeader>
                <CardContent className="p-4 space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Bester Verkoster dieses Flights: </span>
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
          </div>
        </div>
      </div>
      {/* Participant guesses vs host wines modal */}
      <Dialog open={participantDialog.open} onOpenChange={(o) => setParticipantDialog(s => ({ ...s, open: o }))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tipps von {participantDialog.participant?.user?.name || participantDialog.participant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 max-h-[70vh] overflow-auto pr-1">
            {flights.map((f, fIdx) => (
              <div key={f.id}>
                <h3 className="text-base font-semibold text-gray-800 mb-2">{f.name}</h3>
                <div className="space-y-3">
                  {(f.wines || []).map((wine) => {
                    const g = participantGuesses?.find(x => x.wineId === wine.id);
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
                              const auto = computeAuto(g as any, wine as any, r);
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
                            if (base && adj.remove.has(key)) return false; // auto but removed
                            if (!base && adj.add.has(key)) return true; // manual add
                          }
                          return base;
                        };
                        const chip = (label: string, active: boolean, onClick: () => void, points: number) => {
                          if (!points) return null; // Felder ohne Punkte ausblenden
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
                        return (
                          <div className="flex flex-wrap">
                            {chip(g.country || '-', isActive('country'), () => handleToggle(g, wine, 'country'), r.country)}
                            {chip(g.region || '-', isActive('region'), () => handleToggle(g, wine, 'region'), r.region)}
                            {chip(g.producer || '-', isActive('producer'), () => handleToggle(g, wine, 'producer'), r.producer)}
                            {chip(g.name || '-', isActive('name'), () => handleToggle(g, wine, 'name'), r.wineName)}
                            {chip(g.vintage || '-', isActive('vintage'), () => handleToggle(g, wine, 'vintage'), r.vintage)}
                            {r.anyVarietalPoint
                              ? (
                                (g.varietals || []).map((v, i) => {
                                  const base = !!(auto.varietalMatches || [])[i];
                                  const curr = varietalAdjustments[g.id];
                                  const add = curr?.add || new Set<string>();
                                  const remove = curr?.remove || new Set<string>();
                                  const active = (base && !remove.has(v)) || (!base && add.has(v));
                                  return chip(v, active, () => handleToggleVarietal(g, wine, v), r.varietals);
                                })
                              )
                              : chip(
                                  g.varietals && g.varietals.length ? g.varietals.join(', ') : '-',
                                  isActive('varietals'),
                                  () => handleToggle(g, wine, 'varietals'),
                                  r.varietals
                                )
                            }
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
