import { useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Leaderboard from '@/components/tasting/leaderboard';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';

type Participant = {
  id: number;
  tastingId: number;
  userId: number;
  score: number;
  user: { id: number; name: string };
};

type ScoringRule = {
  tastingId: number;
  country: number;
  region: number;
  producer: number;
  wineName: number;
  vintage: number;
  varietals: number;
  displayCount?: number | null;
};

export default function FinalResults() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const [_, navigate] = useLocation();
  const { user } = useAuth();

  const { data: participants } = useQuery<Participant[]>({
    queryKey: [`/api/tastings/${tastingId}/participants`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/participants`);
      if (!res.ok) throw new Error('Teilnehmer konnten nicht geladen werden');
      return res.json();
    },
    enabled: !isNaN(tastingId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const { data: scoring } = useQuery<ScoringRule>({
    queryKey: [`/api/tastings/${tastingId}/scoring`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/scoring`);
      if (!res.ok) throw new Error('Scoring konnte nicht geladen werden');
      return res.json();
    },
    enabled: !isNaN(tastingId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const { data: flights } = useQuery<any[]>({
    queryKey: [`/api/tastings/${tastingId}/flights`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/flights`);
      if (!res.ok) throw new Error('Flights konnten nicht geladen werden');
      return res.json();
    },
    enabled: !isNaN(tastingId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const totalWines = useMemo(() => (flights ? flights.reduce((sum, f) => sum + (f.wines?.length || 0), 0) : 0), [flights]);
  const maxPointsPerWine = (scoring?.country ?? 0) + (scoring?.region ?? 0) + (scoring?.producer ?? 0) + (scoring?.wineName ?? 0) + (scoring?.vintage ?? 0) + (scoring?.varietals ?? 0);
  const maxPoints = totalWines * maxPointsPerWine;

  const me = participants?.find(p => (p as any).userId === user?.id || p.user?.id === user?.id);
  const sorted = participants ? [...participants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [];
  const rank = me ? sorted.findIndex(p => ((p as any).userId === (me as any).userId) || (p.user?.id === (me as any).user?.id)) + 1 : null;

  // Für Weine + eigene Tipps
  const { data: myParticipant } = useQuery<Participant | undefined>({
    queryKey: [`/api/tastings/${tastingId}/participant/self`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/participants`);
      const list: Participant[] = await res.json();
      return list.find(p => (p as any).userId === user?.id || p.user?.id === user?.id);
    },
    enabled: !!user?.id && !isNaN(tastingId),
  });

  type Guess = { id: number; wineId: number; score: number; wine?: any; [k: string]: any };
  const { data: myGuesses } = useQuery<Guess[]>({
    queryKey: myParticipant ? [`/api/participants/${myParticipant.id}/guesses`] : ['none'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/participants/${myParticipant!.id}/guesses`);
      if (!res.ok) throw new Error('Tipps konnten nicht geladen werden');
      return res.json();
    },
    enabled: !!myParticipant,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Sofort aktualisieren, wenn Server Scores pusht
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
          queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/scoring`] });
          if (myParticipant) {
            queryClient.invalidateQueries({ queryKey: [`/api/participants/${myParticipant.id}/guesses`] });
          }
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [tastingId, myParticipant]);

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Endergebnis</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="p-4 rounded border bg-gray-50 text-center">
            <div className="text-sm text-gray-600">Ihre Platzierung</div>
            <div className="text-4xl font-bold text-[#274E37] mt-1">{rank ?? '-'}</div>
          </div>
          <div className="p-4 rounded border bg-gray-50 text-center">
            <div className="text-sm text-gray-600">Ihre Punkte</div>
            <div className="text-4xl font-bold mt-1">{me?.score ?? 0}</div>
          </div>
          <div className="p-4 rounded border bg-gray-50 text-center">
            <div className="text-sm text-gray-600">Max. Punkte</div>
            <div className="text-4xl font-bold mt-1">{maxPoints}</div>
          </div>
        </CardContent>
      </Card>

      <Leaderboard tastingId={tastingId} displayCount={scoring?.displayCount ?? null} currentUserId={user?.id ?? undefined} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Ihre Tipps je Wein</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {flights?.flatMap((f, idx) => (f.wines || []).map((w: any) => ({...w, flightIndex: idx+1})))?.map((wine: any) => {
            const g = myGuesses?.find(x => x.wineId === wine.id);
            return (
              <div key={wine.id} className="p-3 rounded border bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="h-7 w-7 mr-2 flex items-center justify-center rounded-full bg-[#274E37] text-white">
                      {wine.letterCode}
                    </span>
                    <div>
                      <div className="font-medium">{wine.producer} {wine.name}</div>
                      <div className="text-sm text-gray-600">{wine.region}, {wine.country}, {wine.vintage}</div>
                    </div>
                  </div>
                  <Badge className="bg-[#274E37]">{g?.score ?? 0} Pkt</Badge>
                </div>
                {g ? (
                  <div className="mt-2 text-sm text-gray-700">
                    <div>Ihr Tipp: {g.country || '-'}, {g.region || '-'}, {g.producer || '-'}, {g.name || '-'}, {g.vintage || '-'}{g.varietals ? `, ${g.varietals.join(', ')}` : ''}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-gray-500">Kein Tipp abgegeben</div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="text-center">
        <Button onClick={() => navigate('/')} className="bg-[#274E37] hover:bg-[#e65b2d]">Zur Startseite</Button>
      </div>
    </div>
  );
}
