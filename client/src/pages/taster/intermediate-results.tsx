import { useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';

type Participant = {
  id: number;
  tastingId: number;
  userId: number;
  score: number;
  user: { id: number; name: string };
};

type FlightSummary = {
  id: number;
  orderIndex?: number | null;
  name?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

const formatFlightDescriptor = (flight: FlightSummary | null | undefined) => {
  if (!flight) return null;
  const numericOrder = Number(flight.orderIndex);
  const hasValidOrder = Number.isFinite(numericOrder);
  const orderLabel = hasValidOrder ? `Flight ${numericOrder + 1}` : '';
  const trimmedName = typeof flight.name === 'string' ? flight.name.trim() : '';

  if (!orderLabel && !trimmedName) return null;

  if (orderLabel && trimmedName) {
    if (trimmedName.toLowerCase() === orderLabel.toLowerCase()) {
      return orderLabel;
    }
    return `${orderLabel} - ${trimmedName}`;
  }

  return orderLabel || trimmedName || null;
};

const findUpcomingFlight = (flights?: FlightSummary[] | null) => {
  if (!Array.isArray(flights)) return null;
  return [...flights]
    .filter((flight) => !flight.startedAt)
    .sort((a, b) => {
      const orderA = Number(a.orderIndex);
      const orderB = Number(b.orderIndex);
      if (!Number.isFinite(orderA) && !Number.isFinite(orderB)) return 0;
      if (!Number.isFinite(orderA)) return 1;
      if (!Number.isFinite(orderB)) return -1;
      return orderA - orderB;
    })[0] ?? null;
};

export default function IntermediateResults() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const [_, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: participants } = useQuery<Participant[]>({
    queryKey: [`/api/tastings/${tastingId}/participants`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/participants`);
      if (!res.ok) throw new Error('Teilnehmer konnten nicht geladen werden');
      return res.json();
    },
    enabled: !isNaN(tastingId),
    refetchInterval: 2000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const my = participants?.find(p => (p as any).userId === user?.id || p.user?.id === user?.id);
  const sorted = participants ? [...participants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [];
  const rank = my ? sorted.findIndex(p => ((p as any).userId === my.userId) || (p.user?.id === my?.user?.id)) + 1 : null;

  // Auto-poll to move on when next flight starts
  const { data: flights } = useQuery<FlightSummary[]>({
    queryKey: [`/api/tastings/${tastingId}/flights`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/flights`);
      if (!res.ok) throw new Error('Flights konnten nicht geladen werden');
      return res.json();
    },
    enabled: !isNaN(tastingId),
    refetchInterval: 2000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Reagiere auf scores_updated, um sofort Punkte/Rank zu aktualisieren
  useEffect(() => {
    if (!tastingId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/join?t=${tastingId}`);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg?.type === 'scores_updated' || msg?.type === 'flight_completed') {
          queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/participants`] });
          queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/flights`] });
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [tastingId, queryClient]);

  useEffect(() => {
    if (!flights) return;
    const anyActive = flights.some((f: any) => f.startedAt && !f.completedAt);
    if (anyActive) {
      const active = flights.find((f: any) => f.startedAt && !f.completedAt);
      if (active) navigate(`/tasting/${tastingId}/submit?flight=${active.id}`);
      return;
    }
    const total = flights.length;
    const allCompleted = total === 0 || (total > 0 && flights.every((f: any) => !!f.completedAt));
    if (allCompleted) navigate(`/tasting/${tastingId}/results`);
  }, [flights, navigate, tastingId]);

  const nextFlight = useMemo(() => findUpcomingFlight(flights), [flights]);
  const nextFlightDescriptor = useMemo(() => formatFlightDescriptor(nextFlight), [nextFlight]);

  return (
    <div className="container mx-auto py-10 px-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Zwischenergebnis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            {rank ? (
              <>
                <p className="text-4xl font-bold text-[#274E37]">Platz {rank}</p>
                <p className="text-lg mt-2">Punkte: <span className="font-semibold">{my?.score ?? 0}</span></p>
              </>
            ) : (
              <p>
                {participants && participants.length > 0
                  ? 'Ihre Punkte werden geladen…'
                  : 'Noch keine Teilnehmer oder keine Daten verfügbar.'}
              </p>
            )}
          </div>
          <div className="text-center text-gray-600 mt-6 space-y-1">
            <p>Neuer Flight wird vorbereitet.</p>
            <p>
              Gläser werden eingeschenkt, gleich geht’s los…
              {nextFlightDescriptor && <> mit dem {nextFlightDescriptor}</>}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
