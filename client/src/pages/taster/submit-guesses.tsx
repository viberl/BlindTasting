import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Tasting,
  Flight as BaseFlight,
  Wine,
  Participant,
  InsertGuess
} from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, Wine as WineIcon, Globe, MapPin, 
  Building, Tag, Calendar, Grape, Star, X
} from "lucide-react";
import clsx from 'clsx';
import { useToast } from "@/hooks/use-toast";
import FlightTimer from "@/components/flight/flight-timer";
import { countries as COUNTRY_LIST, countryToRegions } from "@/data/country-regions";
import VarietalCombobox from "@/components/wine/varietal-combobox";

// Options for dropdowns (German)
const countries = COUNTRY_LIST;
// Rebsorten mit Suche kommen aus VarietalCombobox

// Create guess schema
const guessSchema = z.object({
  country: z.string().optional(),
  region: z.string().optional(),
  producer: z.string().optional(),
  name: z.string().optional(),
  vintage: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}$/, { message: "Bitte 4-stelliges Jahr" }).optional()),
  rating: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(88).max(100).nullable().optional()
  ),
  notes: z.string().optional(),
});

type GuessFormData = z.infer<typeof guessSchema>;

export default function SubmitGuesses() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Timer state (only becomes active when host explicitly starts a timer)
  const [timerActive, setTimerActive] = useState(false);
  const [timerLimit, setTimerLimit] = useState<number>(0);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);

  // Get flight ID from URL query parameter (use window.location.search – wouter's location excludes query)
  const rawSearch = typeof window !== 'undefined' ? window.location.search : '';
  const searchParams = new URLSearchParams(rawSearch || '');
  const flightId = parseInt(searchParams.get('flight') || '0', 10);

  const [selectedWineId, setSelectedWineId] = useState<number | null>(null);
  const [selectedVarietals, setSelectedVarietals] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [guessedWineIds, setGuessedWineIds] = useState<Set<number>>(new Set());

  // Queries
  const { data: tasting, isLoading: tastingLoading } = useQuery<Tasting>({
    queryKey: [`/api/tastings/${tastingId}`],
  });

  type Flight = BaseFlight & { wines: Wine[] };

  const { data: flights, isLoading: flightsLoading } = useQuery<Flight[]>({
    queryKey: ['flights', tastingId],
    queryFn: async () => {
      const res = await fetch(`/api/tastings/${tastingId}/flights`, { credentials: 'include' });
      if (!res.ok) throw new Error('Fehler beim Laden der Flights');
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 2000,
  } as any);

  const { data: participants, isLoading: participantsLoading } = useQuery<Participant[]>({
    queryKey: [`/api/tastings/${tastingId}/participants`],
    staleTime: 0,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (participants && participants.length > 0 && user?.id) {
      const currentParticipant = participants.find(p => p.userId === user.id);
      if (currentParticipant) {
        setCurrentParticipantId(currentParticipant.id);
      }
    }
  }, [participants, user]);

  const [currentParticipantId, setCurrentParticipantId] = useState<number | null>(null);
  
  // Load existing guesses for visual indicators
  useQuery<{ wineId: number; wine?: Wine }[]>({
    queryKey: currentParticipantId ? [`/api/participants/${currentParticipantId}/guesses`] : ['ignored-guesses'],
    enabled: !!currentParticipantId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 5000,
    select: (data) => data as any,
    onSuccess: (data) => {
      const ids = new Set<number>();
      for (const g of data || []) {
        if (g?.wine?.id) ids.add(g.wine.id);
        else if (g?.wineId) ids.add(g.wineId);
      }
      setGuessedWineIds(ids);
    }
  } as any);
  const [attemptedAutoJoin, setAttemptedAutoJoin] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");

  // Get the current flight
  // Pick current flight: prefer "flight" query param, otherwise active started flight
  const currentFlight = flights?.find(f => f.id === flightId) ||
    flights?.find(f => f.startedAt && !f.completedAt);

  // Listen for timer_started via WebSocket to enable the timer only when host sets it
  useEffect(() => {
    if (!tastingId || !currentFlight?.id) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const u = user?.id ? `&u=${user.id}` : '';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/join?t=${tastingId}${u}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'timer_started' && data.flightId === currentFlight.id) {
          setTimerActive(true);
          setTimerLimit(Number(data.timeLimit) || 0);
          setTimerStartedAt(data.startedAt || new Date().toISOString());
        } else if (data.type === 'flight_completed') {
          // Nach Flight-Ende: prüfen, ob alle Flights abgeschlossen sind → Endergebnisse, sonst Zwischen
          if (data.allCompleted === true) {
            navigate(`/tasting/${tastingId}/results`);
          } else {
            navigate(`/tasting/${tastingId}/intermediate`);
          }
        }
      } catch {}
    };

    return () => {
      try { ws.close(); } catch {}
    };
  }, [tastingId, currentFlight?.id, user?.id]);

  // Fallback: Wenn Polling anzeigt, dass der Flight abgeschlossen ist, ebenfalls weiterleiten
  useEffect(() => {
    if (currentFlight?.completedAt) {
      (async () => {
        try {
          const res = await fetch(`/api/tastings/${tastingId}/flights`, { credentials: 'include' });
          if (res.ok) {
            const fls = await res.json();
            const allCompleted = (fls || []).length > 0 && (fls || []).every((f: any) => !!f.completedAt);
            if (allCompleted) navigate(`/tasting/${tastingId}/results`);
            else navigate(`/tasting/${tastingId}/intermediate`);
          } else {
            navigate(`/tasting/${tastingId}`);
          }
        } catch {
          navigate(`/tasting/${tastingId}`);
        }
      })();
    }
  }, [currentFlight?.completedAt, currentFlight?.id, navigate, tastingId]);

  // Robustes Fallback: lokale Deadline überwachen und dann Weiterleitung auslösen
  useEffect(() => {
    if (!timerActive || !timerStartedAt || !timerLimit) return;
    const started = new Date(timerStartedAt).getTime();
    const deadline = started + Number(timerLimit) * 1000;

    const checkAndRedirect = async () => {
      try {
        const res = await fetch(`/api/tastings/${tastingId}/flights`, { credentials: 'include' });
        if (res.ok) {
          const fls = await res.json();
          const remaining = (fls || []).some((f: any) => !f.completedAt);
          if (remaining) navigate(`/tasting/${tastingId}/intermediate`);
          else navigate(`/tasting/${tastingId}/results`);
        }
      } catch {}
    };

    const now = Date.now();
    const delay = Math.max(0, deadline - now + 500); // 0.5s Puffer
    const t = setTimeout(checkAndRedirect, delay);
    return () => clearTimeout(t);
  }, [timerActive, timerStartedAt, timerLimit, tastingId, navigate]);

  // Reset timer state when flight changes
  useEffect(() => {
    setTimerActive(false);
    setTimerLimit(0);
    setTimerStartedAt(null);
  }, [currentFlight?.id]);

  // Set up form with react-hook-form
  const form = useForm<GuessFormData>({
    resolver: zodResolver(guessSchema),
    mode: "onChange",
    defaultValues: {
      country: "",
      region: "",
      producer: "",
      name: "",
      vintage: "",
      rating: null,
      notes: "",
    },
  });

  // Reset form when selected wine changes
  useEffect(() => {
    form.reset({
      country: "",
      region: "",
      producer: "",
      name: "",
      vintage: "",
      rating: null,
      notes: "",
    });
    setSelectedVarietals([]);
  }, [selectedWineId, form]);

  // Update available regions when country changes
  useEffect(() => {
    const country = form.watch("country");
    if (country && countryToRegions[country as keyof typeof countryToRegions]) {
      setAvailableRegions(countryToRegions[country as keyof typeof countryToRegions]);
      // reset region when country changes
      form.setValue("region", "");
    } else {
      setAvailableRegions([]);
      form.setValue("region", "");
    }
  }, [form.watch("country")]);

  // Set first wine as selected on load
  useEffect(() => {
    if (currentFlight?.wines && currentFlight.wines.length > 0 && !selectedWineId) {
      setSelectedWineId(currentFlight.wines[0].id);
      setActiveTab(currentFlight.wines[0].letterCode);
    }
  }, [currentFlight, selectedWineId]);

  // Auto-Join fallback: wenn der Nutzer (noch) nicht in der Teilnehmerliste ist, versuche beizutreten
  useEffect(() => {
    const tryAutoJoin = async () => {
      if (!user?.id || !tastingId) return;
      if (!participants || participantsLoading) return;
      const isParticipant = participants.some(p => p.userId === user.id);
      if (!isParticipant && !attemptedAutoJoin) {
        try {
          await apiRequest('POST', `/api/tastings/${tastingId}/join`, {});
          // Nach Join neu laden
          await queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/participants`] });
        } catch (e) {
          // Ignorieren; UI zeigt dann weiterhin den Hinweis
        } finally {
          setAttemptedAutoJoin(true);
        }
      }
    };
    tryAutoJoin();
  }, [participants, participantsLoading, user?.id, tastingId, attemptedAutoJoin]);

  // Submit guess mutation
  const submitGuessMutation = useMutation({
    // Server setzt participantId und wineId selbst; Client sendet nur Felder aus dem Formular
    mutationFn: async (data: Partial<InsertGuess>) => {
      const res = await apiRequest("POST", `/api/wines/${selectedWineId}/guess`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Tipp gespeichert",
        description: `Ihr Tipp für Wein ${currentFlight?.wines.find(w => w.id === selectedWineId)?.letterCode} wurde gespeichert.`,
      });
      if (selectedWineId) {
        setGuessedWineIds(prev => new Set(prev).add(selectedWineId));
      }
      
      // Move to the next wine if available
      if (currentFlight?.wines) {
        const currentIndex = currentFlight.wines.findIndex(w => w.id === selectedWineId);
        if (currentIndex < currentFlight.wines.length - 1) {
          const nextWine = currentFlight.wines[currentIndex + 1];
          setSelectedWineId(nextWine.id);
          setActiveTab(nextWine.letterCode);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Tipp konnte nicht gesendet werden",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle adding and removing varietals
  const removeVarietal = (varietal: string) => {
    const newVarietals = selectedVarietals.filter(v => v !== varietal);
    setSelectedVarietals(newVarietals);
  };

  // Handle form submission
  const onSubmit = (formData: GuessFormData) => {
    if (!selectedWineId) {
      toast({
        title: "Fehler",
        description: "Tipp kann nicht gesendet werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
      return;
    }

    submitGuessMutation.mutate({
      ...formData,
      varietals: selectedVarietals,
    });
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const selectedWine = currentFlight?.wines.find(w => w.letterCode === value);
    if (selectedWine) {
      setSelectedWineId(selectedWine.id);
      // reset vintage choice when switching wines
      form.setValue("vintage", "");
    }
  };

  // Handle completing the flight and returning to tasting details
  const handleFinish = () => {
    navigate(`/tasting/${tastingId}`);
  };

  // Loading state (initial fetch only). Keep form visible during refetches.
  if ((tastingLoading || flightsLoading || participantsLoading) && !flights) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#274E37]" />
      </div>
    );
  }

  // If we have data but no active/current flight, show info instead of spinner
  if (!currentFlight) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-amber-600">Flight nicht aktiv</h2>
          <p className="mt-2">Dieser Flight ist derzeit nicht aktiv.</p>
          <Button className="mt-4" onClick={() => navigate(`/tasting/${tastingId}`)}>
            Zurück zur Verkostung
          </Button>
        </div>
      </div>
    );
  }

  // Check if user is a participant
  if (!participantsLoading && attemptedAutoJoin && !participants?.some(p => p.userId === user?.id)) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Kein Teilnehmer</h2>
          <p className="mt-2">Sie nehmen an dieser Verkostung nicht teil.</p>
          <Button className="mt-4" onClick={() => navigate(`/tasting/${tastingId}`)}>
            Zurück zur Verkostung
          </Button>
        </div>
      </div>
    );
  }

  // Check if flight is active
  if (!currentFlight.startedAt || currentFlight.completedAt) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-amber-600">Flight nicht aktiv</h2>
          <p className="mt-2">Dieser Flight ist derzeit nicht aktiv.</p>
          <Button className="mt-4" onClick={() => navigate(`/tasting/${tastingId}`)}>
            Zurück zur Verkostung
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Card className="border-none shadow-lg mb-8">
          <CardHeader className="border-b bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-2xl font-display text-[#274E37]">Tipps abgeben</CardTitle>
                </div>
                <CardDescription>
                  {currentFlight.name}
                </CardDescription>
              </div>
              {timerActive && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">Verbleibende Zeit</p>
                  <FlightTimer
                    flightId={currentFlight.id}
                    timeLimit={timerLimit}
                    startedAt={timerStartedAt}
                    completedAt={currentFlight.completedAt}
                    isHost={false}
                  />
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="py-6">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
              <TabsList className="flex-wrap">
                {currentFlight.wines.map((wine) => (
                  <TabsTrigger key={wine.id} value={wine.letterCode} className="flex items-center space-x-2">
                    <span className={clsx("h-6 w-6 flex items-center justify-center bg-[#274E37] text-white rounded-full text-sm font-medium", guessedWineIds.has(wine.id) && "border-2 border-orange-500") }>
                      {wine.letterCode}
                    </span>
                    <span>Wein {wine.letterCode}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {currentFlight.wines.map((wine) => (
                <TabsContent key={wine.id} value={wine.letterCode} className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4 flex items-center">
                    <span className={clsx("h-10 w-10 flex items-center justify-center bg-[#274E37] text-white rounded-full text-lg font-medium mr-3", guessedWineIds.has(wine.id) && "border-4 border-orange-500") }>
                      {wine.letterCode}
                    </span>
                    <h3 className="text-lg font-medium text-gray-900">Wein {wine.letterCode}</h3>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center">
                                  <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                                  Land
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Land auswählen" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {countries.map(country => (
                                      <SelectItem key={country} value={country}>{country}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="region"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center">
                                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                                  Region
                                </FormLabel>
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value || ""} 
                                  disabled={!form.watch("country")}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Region auswählen" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {availableRegions.map(region => (
                                      <SelectItem key={region} value={region}>{region}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="producer"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center">
                                  <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                                  Weingut
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="z. B. Château Margaux" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center">
                                  <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                                  Weinname
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="z. B. Grand Vin" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="space-y-4">
                          {(() => {
                            const selectedWine = currentFlight?.wines.find(w => w.id === selectedWineId);
                            const noVintage = selectedWine?.vintage?.toLowerCase() === "kein jahrgang";
                            return (
                              <FormField
                                control={form.control}
                                name="vintage"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="flex items-center">
                                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                                      Jahrgang
                                    </FormLabel>
                                    {noVintage ? (
                                      <Input value="Kein Jahrgang" disabled />
                                    ) : (
                                      <FormControl>
                                        <Input
                                          placeholder="z. B. 2018"
                                          value={field.value || ""}
                                          onChange={(e) => {
                                            const onlyDigits = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                                            field.onChange(onlyDigits);
                                          }}
                                          inputMode="numeric"
                                          pattern="[0-9]{4}"
                                          title="Bitte genau 4 Ziffern eingeben"
                                          maxLength={4}
                                        />
                                      </FormControl>
                                    )}
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            );
                          })()}

                          <div>
                            <FormLabel className="flex items-center">
                              <Grape className="h-4 w-4 mr-2 text-muted-foreground" />
                              Rebsorten (max. 3)
                            </FormLabel>
                            <VarietalCombobox
                              value={selectedVarietals}
                              onChange={setSelectedVarietals}
                              maxSelected={3}
                            />
                            <div className="flex flex-wrap gap-2 mt-2">
                              {selectedVarietals.map(varietal => (
                                <Badge key={varietal} variant="secondary" className="flex items-center gap-1">
                                  {varietal}
                                  <button type="button" onClick={() => removeVarietal(varietal)}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <FormField
                            control={form.control}
                            name="rating"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center">
                                  <Star className="h-4 w-4 mr-2 text-muted-foreground" />
                                  Ihre Bewertung (88–100)
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="92" 
                                    min={88}
                                    max={100}
                                    value={field.value === null ? "" : field.value}
                                    onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Bewerten Sie diesen Wein auf einer Skala von 88 bis 100
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Verkostungsnotizen</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Aromen von Schwarzkirsche, Tabak und Zeder..." 
                                    rows={2}
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end space-x-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleFinish}
                        >
                          Zurück zur Verkostung
                        </Button>
                        <Button 
                          type="submit" 
                          className="bg-[#274E37] hover:bg-[#e65b2d]"
                          disabled={submitGuessMutation.isPending}
                        >
                          {submitGuessMutation.isPending 
                            ? "Senden..." 
                            : `Tipp für Wein ${wine.letterCode} senden`}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
