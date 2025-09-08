import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, UseQueryOptions } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Tasting,
  Wine
} from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Clock, Wine as WineIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WineForm from "@/components/wine/wine-form";
import WineCard from "@/components/wine/wine-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Flight {
  id: number;
  name: string;
  completedAt: Date | null;
  tastingId: number;
  orderIndex: number;
  timeLimit: number;
  startedAt: Date | null;
  wines: Wine[];
}

export default function WinesSetup() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [newFlightName, setNewFlightName] = useState("");
  const [newFlightTimeLimit, setNewFlightTimeLimit] = useState("10");
  const [activeFlightId, setActiveFlightId] = useState<number | null>(null);
  const [addWineDialogOpen, setAddWineDialogOpen] = useState(false);
  const [addFlightDialogOpen, setAddFlightDialogOpen] = useState(false);

  const { data: tasting, isLoading: tastingLoading } = useQuery<Tasting>({
    queryKey: [`/api/tastings/${tastingId}`],
  });

  const fetchFlights = async (tastingId: number) => {
    const res = await fetch(`/api/tastings/${tastingId}/flights`);
    if (!res.ok) throw new Error('Failed to fetch flights');
    return res.json();
  };

  const flightsQueryOptions = {
    queryKey: ['flights', tastingId],
    queryFn: () => fetchFlights(tastingId),
    onSettled: (data: Flight[] | undefined, error: Error | null) => {
      if (error) {
        toast({
          title: 'Fehler beim Laden der Flights',
          description: error.message,
          variant: 'destructive'
        });
      } else if (data && data.length > 0 && !activeFlightId) {
        setActiveFlightId(data[0].id);
      }
    },
    refetchInterval: 3000
  } as UseQueryOptions<Flight[], Error> & { onSettled?: (data: Flight[] | undefined, error: Error | null) => void };

  const { data: flights, isLoading: flightsLoading, refetch: refetchFlights } = useQuery(flightsQueryOptions);

  const createFlightMutation = useMutation({
    mutationFn: async (flightData: { tastingId: number; name: string; orderIndex: number; timeLimit: number }) => {
      const res = await apiRequest("POST", `/api/tastings/${tastingId}/flights`, flightData);
      return res.json();
    },
    onSuccess: (newFlight: Flight) => {
      queryClient.invalidateQueries({ queryKey: ['flights', tastingId] });
      setActiveFlightId(newFlight.id);
      setNewFlightName("");
      setNewFlightTimeLimit("10");
      toast({
        title: "Flight added",
        description: `"${newFlight.name}" has been added to your tasting.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add flight",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addWineMutation = useMutation({
    mutationFn: async (wineData: { flightId: number; name: string; description: string }) => {
      const res = await apiRequest("POST", `/api/flights/${wineData.flightId}/wines`, wineData);
      return res.json();
    },
    onSuccess: (newWine: Wine) => {
      queryClient.invalidateQueries({ queryKey: ['flights', tastingId] });
      // Sofortiges Nachladen der Daten erzwingen
      setTimeout(() => refetchFlights(), 300);
      setAddWineDialogOpen(false);
      toast({
        title: "Wein hinzugefügt",
        description: `${newWine.name} wurde zum Flight hinzugefügt.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add wine",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateFlight = () => {
    if (!newFlightName) {
      toast({
        title: "Flight name required",
        description: "Please enter a name for this flight.",
        variant: "destructive",
      });
      return;
    }

    const timeLimit = parseInt(newFlightTimeLimit) * 60; // Convert minutes to seconds
    
    createFlightMutation.mutate({
      tastingId,
      name: newFlightName,
      orderIndex: flights?.length || 0,
      timeLimit: timeLimit,
    });
  };

  const handleAddWine = (wineData: { flightId: number; name: string; description: string }) => {
    addWineMutation.mutate(wineData);
    // Dialog zuerst schließen, dann nach erfolgreichem Hinzufügen des Weins neu laden
    setAddWineDialogOpen(false);
    
    // Sofort neu laden, ohne auf die Cache-Invalidierung zu warten
    setTimeout(() => {
      refetchFlights();
    }, 500);
  };

  const handleFinish = () => {
    navigate(`/host/summary/${tastingId}`);
  };

  if (tastingLoading || flightsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#274E37]" />
      </div>
    );
  }

  if (!tasting) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Tasting not found</h2>
          <p className="mt-2">This tasting does not exist or you don't have access to it.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const getWinesForActiveFlight = (): Wine[] => {
    if (!activeFlightId || !flights) return [];
    const flight = flights.find(f => f.id === activeFlightId);
    return flight?.wines || [];
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <Card className="border-none shadow-lg">
          <CardHeader className="border-b bg-gray-50 rounded-t-lg">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-display text-[#274E37]">Add Wines to Flights</CardTitle>
                <CardDescription>
                  Create flights and add wines for your tasting: "{tasting.name}"
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center">1</div>
                <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center">2</div>
                <div className="w-8 h-8 rounded-full bg-[#274E37] text-white flex items-center justify-center">3</div>
                <span className="text-xs text-gray-500 hidden sm:inline">Wines</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="py-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Flights</h3>
              <Button 
                variant="outline" 
                className="flex items-center"
                onClick={() => setAddFlightDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Flight
              </Button>
            </div>

            {flights && flights.length > 0 ? (
              <div>
                <Accordion
                  type="single"
                  collapsible
                  value={activeFlightId?.toString() || undefined}
                  onValueChange={(value) => setActiveFlightId(value ? parseInt(value) : null)}
                >
                  {flights.map((flight, index) => (
                    <AccordionItem key={flight.id} value={flight.id.toString()}>
                      <AccordionTrigger className="hover:bg-gray-50 px-4 rounded-md">
                        <div className="flex items-center">
                          <div className="h-6 w-6 rounded-full bg-[#274E37] text-white flex items-center justify-center text-sm mr-3">
                            {index + 1}
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{flight.name}</p>
                            <p className="text-sm text-gray-500">
                              {flight.wines?.length || 0} wines, {Math.floor(flight.timeLimit / 60)} min timer
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium">Wines in this flight</h4>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="flex items-center"
                              onClick={() => setAddWineDialogOpen(true)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Wein hinzufügen
                            </Button>
                          </div>

                          {flight.wines && flight.wines.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {flight.wines.map((wine) => (
                                <WineCard 
                                  key={wine.id}
                                  wine={wine}
                                  isHost={true}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-md">
                              <WineIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                              <p className="text-gray-500">No wines added to this flight yet</p>
                              <Button 
                                variant="outline" 
                                className="mt-4"
                                onClick={() => setAddWineDialogOpen(true)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Your First Wine
                              </Button>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <WineIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-800 mb-2">No Flights Created Yet</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-6">
                  Create flights to organize your wines. Each flight can contain multiple wines for tasters to identify.
                </p>
                <Button 
                  onClick={() => setAddFlightDialogOpen(true)}
                  className="bg-[#274E37] hover:bg-[#e65b2d]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Flight
                </Button>
              </div>
            )}
          </CardContent>

          <CardFooter className="bg-gray-50 rounded-b-lg border-t flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/host/scoring/${tastingId}`)}
            >
              Back
            </Button>
            <Button
              className="bg-[#274E37] hover:bg-[#e65b2d]"
              onClick={handleFinish}
              disabled={!flights || flights.length === 0 || flights.some(f => !f.wines || f.wines.length === 0)}
            >
              Next: Review & Launch
            </Button>
          </CardFooter>
        </Card>
      </div>
      <Dialog open={addFlightDialogOpen} onOpenChange={setAddFlightDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Flight erstellen</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="flightName" className="text-right">
                Name
              </Label>
              <Input
                id="flightName"
                value={newFlightName}
                onChange={(e) => setNewFlightName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="flightTimeLimit" className="text-right">
                Zeitlimit (Minuten)
              </Label>
              <Input
                id="flightTimeLimit"
                type="number"
                value={newFlightTimeLimit}
                onChange={(e) => setNewFlightTimeLimit(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={async () => {
                await handleCreateFlight();
                setAddFlightDialogOpen(false);
              }}
            >
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
