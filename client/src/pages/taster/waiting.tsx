import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type Participant = {
  id: number;
  tastingId: number;
  userId: number;
  name: string;
  joinedAt: string;
  score: number;
  user: {
    id: number;
    name: string;
    email: string;
    company: string;
    profileImage: string;
  };
  isHost: boolean;
};

type SimpleFlightInfo = {
  id: number;
  orderIndex?: number | null;
  name?: string | null;
};

const formatFlightDescriptor = (flight: SimpleFlightInfo | null) => {
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

export default function WaitingPage() {
  const [match, params] = useRoute("/taster/waiting/:id");
  const tastingId = params?.id as string;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connected, setConnected] = useState(false);
  const [tastingStarted, setTastingStarted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [upcomingFlight, setUpcomingFlight] = useState<SimpleFlightInfo | null>(null);

  // Lazy create / resume an AudioContext
  const ensureAudioContext = async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      setAudioEnabled(true);
      return audioCtxRef.current;
    } catch (e) {
      setAudioEnabled(false);
      return null;
    }
  };

  // Basic synthesized "glug glug" (pouring) using WebAudio
  const playPourSound = async () => {
    const ctx = await ensureAudioContext();
    if (!ctx) {
      toast({ title: 'Sound stumm', description: 'Tippen/Klicken, um Sound zu aktivieren.', variant: 'destructive' });
      return;
    }
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.15; // overall volume
    master.connect(ctx.destination);

    // Create 4 short bubbling notes with randomized pitch
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.22;
      const freq = 200 + Math.random() * 120; // bubbly tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.2);
    }
    // low rumble as liquid stream
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.25;
    noise.buffer = buffer;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.08, now);
    nGain.gain.linearRampToValueAtTime(0.0, now + 0.6);
    noise.connect(nGain);
    nGain.connect(master);
    noise.start(now);
    noise.stop(now + 0.6);
  };

  // Synthesized glass clink
  const playClinkSound = async () => {
    const ctx = await ensureAudioContext();
    if (!ctx) {
      toast({ title: 'Sound stumm', description: 'Tippen/Klicken, um Sound zu aktivieren.', variant: 'destructive' });
      return;
    }
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);
    // High sine ping
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.3);
    // Short noise burst for sparkle
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    noise.buffer = buffer;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.25, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(nGain);
    nGain.connect(master);
    noise.start(now);
    noise.stop(now + 0.12);
  };

  const skipLeaveRef = useRef(false);

  useEffect(() => {
    if (!tastingId || !user?.id) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const u = user?.id ? `&u=${user.id}` : '';
    const ws = new WebSocket(
      `${protocol}://${window.location.host}/ws/join?t=${tastingId}${u}`
    );
    
    ws.onopen = () => setConnected(true);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'participant_removed' && data.userId) {
          // Wenn ein Teilnehmer entfernt wurde, aktualisiere die Liste
          setParticipants(prev => prev.filter(p => p.userId !== data.userId));
          
          // Wenn der aktuelle Benutzer entfernt wurde, leite zur Startseite weiter
          if (data.userId === user?.id) {
            toast({
              title: "Sie wurden entfernt",
              description: "Der Veranstalter hat Sie aus der Verkostung entfernt.",
              variant: "destructive"
            });
            setTimeout(() => setLocation("/"), 3000);
          }
        } else if (data.type === 'tasting_status' && data.status) {
          const st = String(data.status).toLowerCase();
          // Nur wenn der Host explizit gestartet hat
          if (st === 'started') {
            setTastingStarted(true);
            // Pouring sound when tasting has started
            playPourSound();
          }
        } else if (data.type === 'flight_started' && data.flightId) {
          // Navigate to submit UI for the started flight
          // Play clink sound just before navigating
          playClinkSound();
          // Wir wechseln intern zur Eingabe – nicht vom Tasting abmelden
          skipLeaveRef.current = true;
          setLocation(`/tasting/${tastingId}/submit?flight=${data.flightId}`);
        } else if (data.participants) {
          // Normale Aktualisierung der Teilnehmerliste
          setParticipants(data.participants);
        }
      } catch (e) {
        console.error("Fehler beim Verarbeiten der WebSocket-Nachricht:", e);
      }
    };
    
    ws.onerror = (event) => {
      console.error("WebSocket error:", event);
      toast({ 
        title: "Verbindungsfehler", 
        description: "Verbindung zum Server unterbrochen", 
        variant: "destructive" 
      });
    };
    
    ws.onclose = () => setConnected(false);
    
    return () => {
      // Beim Verlassen Seite: Leave-Call mit keepalive senden
      if (!skipLeaveRef.current) {
        try {
          const url = `/api/tastings/${tastingId}/leave`;
          if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
          } else {
            fetch(url, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: '{}' });
          }
        } catch {}
      }
      ws.close();
    };
  }, [tastingId, toast, setLocation, user?.id]);

  // Beim Laden den aktuellen Tasting-Status prüfen
  useEffect(() => {
    (async () => {
      try {
        if (!tastingId) return;
        const res = await fetch(`/api/tastings/${tastingId}`, { credentials: 'include' });
        if (res.ok) {
          const t = await res.json();
          const st = String(t?.status || '').toLowerCase();
          // Nur 'started' zeigt das Einschenken an. 'active' bedeutet veröffentlicht, aber noch nicht gestartet.
          if (st === 'started') setTastingStarted(true);
        }
      } catch {}
    })();
  }, [tastingId]);

  // Fallback-Polling alle 2s bis gestartet
  useEffect(() => {
    if (!tastingId || tastingStarted) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/tastings/${tastingId}`, { credentials: 'include' });
        if (res.ok) {
          const t = await res.json();
          const st = String(t?.status || '').toLowerCase();
          if (st === 'started') {
            setTastingStarted(true);
            clearInterval(iv);
          }
        }
      } catch {}
    }, 2000);
    return () => clearInterval(iv);
  }, [tastingId, tastingStarted]);

  // Sobald gestartet: Polling für gestarteten Flight und automatische Weiterleitung
  useEffect(() => {
    if (!tastingId || !tastingStarted) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/tastings/${tastingId}/flights`, { credentials: 'include' });
        if (res.ok) {
          const fls = await res.json();
          const active = (fls || []).find((f: any) => f.startedAt && !f.completedAt);
          const pending = (fls || [])
            .filter((f: any) => !f.startedAt)
            .sort((a: any, b: any) => {
              const orderA = Number(a?.orderIndex);
              const orderB = Number(b?.orderIndex);
              if (!Number.isFinite(orderA) && !Number.isFinite(orderB)) return 0;
              if (!Number.isFinite(orderA)) return 1;
              if (!Number.isFinite(orderB)) return -1;
              return orderA - orderB;
            })[0] || null;

          setUpcomingFlight((prev) => {
            if (!pending) {
              return prev ? null : prev;
            }
            const nextInfo: SimpleFlightInfo = {
              id: pending.id,
              orderIndex: pending.orderIndex,
              name: pending.name,
            };

            if (
              prev &&
              prev.id === nextInfo.id &&
              prev.orderIndex === nextInfo.orderIndex &&
              prev.name === nextInfo.name
            ) {
              return prev;
            }

            return nextInfo;
          });

          if (active && !cancelled) {
            // kleine Verzögerung, damit evtl. Sound/Aushang sichtbar ist
            skipLeaveRef.current = true;
            setTimeout(() => setLocation(`/tasting/${tastingId}/submit?flight=${active.id}`), 200);
            return true;
          }
        }
      } catch {}
      return false;
    };

    // Erst sofort prüfen, dann intervallmäßig
    check();
    const iv = setInterval(async () => {
      const done = await check();
      if (done) clearInterval(iv);
    }, 2000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [tastingId, tastingStarted, setLocation]);

  // Zusätzlich: auf Tab/Window Close reagieren
  useEffect(() => {
    const handler = () => {
      try {
        if (!tastingId) return;
        const url = `/api/tastings/${tastingId}/leave`;
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        }
      } catch {}
    };
    // Aktiviert Audio beim ersten User-Klick
    const resumeAudio = () => { ensureAudioContext(); };
    window.addEventListener('beforeunload', handler);
    window.addEventListener('click', resumeAudio, { once: true });
    window.addEventListener('touchstart', resumeAudio, { once: true });
    return () => window.removeEventListener('beforeunload', handler);
  }, [tastingId]);

  const upcomingFlightDescriptor = useMemo(() => formatFlightDescriptor(upcomingFlight), [upcomingFlight]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {tastingStarted ? 'Verkostung wurde gestartet' : 'Warteraum'}
        </h1>
        
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          {!connected && (
            <p className="text-center text-gray-600">Verbindung wird hergestellt...</p>
          )}
          {connected && !tastingStarted && (
            <p className="text-center text-gray-600">
              Warten auf alle Teilnehmer und auf den Start der Verkostung durch den Veranstalter.
              <br />
              (<span className="font-medium">{participants.length}</span> {participants.length === 1 ? 'Verkoster' : 'Verkoster'} im Warteraum)
            </p>
          )}
          {connected && tastingStarted && (
            <p className="text-center text-gray-700 font-medium">
              Gläser werden eingeschenkt, gleich geht’s los…
              {upcomingFlightDescriptor && <> mit dem {upcomingFlightDescriptor}</>}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {participants.map((participant) => (
            <div 
              key={participant.id} 
              className={`flex items-center p-4 border rounded-lg transition-all ${
                participant.isHost 
                  ? 'bg-blue-50 border-blue-200 shadow-md' 
                  : 'bg-white border-gray-100 shadow-sm hover:shadow'
              }`}
            >
              <div className="flex-shrink-0">
                {participant.user.profileImage ? (
                  <img 
                    src={participant.user.profileImage} 
                    alt={participant.user.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500 text-xl font-medium">
                      {participant.user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {participant.user.name}
                  </h3>
                  {participant.isHost && (
                    <span className="ml-2 px-3 py-1 text-sm font-semibold bg-blue-600 text-white rounded-full shadow-sm">
                      Veranstalter
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {participant.user.company || 'Kein Unternehmen angegeben'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
