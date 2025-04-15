import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TastingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const { user } = useAuth();

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

  // Lade Tastings-Details
  const { data: tasting, isLoading: isTastingLoading, error: tastingError } = useQuery<Tasting>({
    queryKey: [`/api/tastings/${tastingId}`],
    enabled: !isNaN(tastingId),
  });

  // Lade Flights für diese Verkostung
  const { data: flights, isLoading: isFlightsLoading } = useQuery<Flight[]>({
    queryKey: [`/api/tastings/${tastingId}/flights`],
    enabled: !isNaN(tastingId) && !!tasting,
  });

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
              <Button 
                onClick={() => updateTastingStatus('active')}
                className="bg-green-600 hover:bg-green-700"
              >
                Verkostung starten
              </Button>
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
            <div className="grid gap-6 md:grid-cols-2">
              {flights.map((flight: any) => (
                <Card key={flight.id} className="overflow-hidden">
                  <CardHeader className="bg-gray-50">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-xl">Flight {flight.orderIndex + 1}: {flight.name}</CardTitle>
                      <Badge variant={flight.completedAt ? 'secondary' : flight.startedAt ? 'default' : 'outline'}>
                        {flight.completedAt ? 'Abgeschlossen' : flight.startedAt ? 'Im Gange' : 'Nicht gestartet'}
                      </Badge>
                    </div>
                    <CardDescription>
                      {flight.timeLimit} Minuten | {flight.wines?.length || 0} Weine
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
                          onClick={() => {/* Funktion zum Hinzufügen von Weinen */}}
                          className="w-full"
                        >
                          Wein hinzufügen
                        </Button>
                        {!flight.startedAt && (
                          <Button
                            size="sm"
                            onClick={() => {/* Funktion zum Starten des Flights */}}
                            className="w-full bg-[#4C0519] hover:bg-[#3A0413]"
                            disabled={tasting.status !== 'active'}
                          >
                            Flight starten
                          </Button>
                        )}
                        {flight.startedAt && !flight.completedAt && (
                          <Button
                            size="sm"
                            onClick={() => {/* Funktion zum Beenden des Flights */}}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            Flight abschließen
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
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
                    onClick={() => {/* Funktion zum Erstellen eines Flights */}}
                  >
                    Neuen Flight erstellen
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {isHost && tasting.status === 'draft' && (
            <Button
              className="w-full bg-[#4C0519] hover:bg-[#3A0413]"
              onClick={() => {/* Funktion zum Erstellen eines Flights */}}
            >
              Neuen Flight erstellen
            </Button>
          )}
        </TabsContent>

        <TabsContent value="participants">
          <Card>
            <CardHeader>
              <CardTitle>Teilnehmer</CardTitle>
              <CardDescription>
                Teilnehmer dieser Verkostung und deren Punktestand
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 my-8">
                Keine Teilnehmer für diese Verkostung.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scoring">
          <Card>
            <CardHeader>
              <CardTitle>Punktesystem</CardTitle>
              <CardDescription>
                Punkteregeln für diese Verkostung
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isHost && tasting.status === 'draft' ? (
                <Button 
                  className="w-full bg-[#4C0519] hover:bg-[#3A0413]"
                  onClick={() => {/* Funktion zum Festlegen des Punktesystems */}}
                >
                  Punktesystem festlegen
                </Button>
              ) : (
                <p className="text-center text-gray-500 my-8">
                  Kein Punktesystem festgelegt.
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
                  Einstellungen für diese Verkostung
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-gray-500 my-8">
                  Diese Funktion ist noch in Entwicklung.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}