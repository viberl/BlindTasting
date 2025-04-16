import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Tasting,
  Flight,
  Wine,
  InsertFlight,
  InsertWine
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
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Clock, Wine as WineIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WineForm from "@/components/wine/wine-form";
import WineCard from "@/components/wine/wine-card";

export default function WinesSetup() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [newFlightName, setNewFlightName] = useState("");
  const [newFlightTimeLimit, setNewFlightTimeLimit] = useState("10");
  const [addFlightDialogOpen, setAddFlightDialogOpen] = useState(false);
  const [activeFlightId, setActiveFlightId] = useState<number | null>(null);
  const [addWineDialogOpen, setAddWineDialogOpen] = useState(false);

  const { data: tasting, isLoading: tastingLoading } = useQuery<Tasting>({
    queryKey: [`/api/tastings/${tastingId}`],
  });

  const { data: flights, isLoading: flightsLoading } = useQuery<Flight[]>({
    queryKey: [`/api/tastings/${tastingId}/flights`],
    onSuccess: (data) => {
      if (data.length > 0 && !activeFlightId) {
        setActiveFlightId(data[0].id);
      }
    },
    refetchInterval: 3000, // Aktualisiert die Flights automatisch alle 3 Sekunden
  });

  const createFlightMutation = useMutation({
    mutationFn: async (flightData: InsertFlight) => {
      const res = await apiRequest("POST", `/api/tastings/${tastingId}/flights`, flightData);
      return res.json();
    },
    onSuccess: (newFlight) => {
      queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/flights`] });
      setActiveFlightId(newFlight.id);
      setAddFlightDialogOpen(false);
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
    mutationFn: async (wineData: Omit<InsertWine, "letterCode">) => {
      const res = await apiRequest("POST", `/api/flights/${wineData.flightId}/wines`, wineData);
      return res.json();
    },
    onSuccess: (newWine) => {
      queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/flights`] });
      toast({
        title: "Wine added",
        description: `${newWine.name} has been added to the flight.`,
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

  const handleAddWine = (wineData: Omit<InsertWine, "letterCode">) => {
    addWineMutation.mutate(wineData);
  };

  const handleFinish = () => {
    navigate(`/host/summary/${tastingId}`);
  };

  if (tastingLoading || flightsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#4C0519]" />
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
                <CardTitle className="text-2xl font-display text-[#4C0519]">Add Wines to Flights</CardTitle>
                <CardDescription>
                  Create flights and add wines for your tasting: "{tasting.name}"
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center">1</div>
                <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center">2</div>
                <div className="w-8 h-8 rounded-full bg-[#4C0519] text-white flex items-center justify-center">3</div>
                <span className="text-xs text-gray-500 hidden sm:inline">Wines</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="py-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Flights</h3>
              <Dialog open={addFlightDialogOpen} onOpenChange={setAddFlightDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Flight
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a New Flight</DialogTitle>
                    <DialogDescription>
                      Create a new flight of wines for tasters to identify.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label htmlFor="flight-name" className="text-sm font-medium">
                        Flight Name
                      </label>
                      <Input
                        id="flight-name"
                        placeholder="e.g. Reds from France"
                        value={newFlightName}
                        onChange={(e) => setNewFlightName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="time-limit" className="text-sm font-medium flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        Time Limit (minutes)
                      </label>
                      <Input
                        id="time-limit"
                        type="number"
                        min="1"
                        max="60"
                        placeholder="10"
                        value={newFlightTimeLimit}
                        onChange={(e) => setNewFlightTimeLimit(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setAddFlightDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateFlight}
                      disabled={createFlightMutation.isPending}
                      className="bg-[#4C0519] hover:bg-[#3A0413]"
                    >
                      {createFlightMutation.isPending ? "Creating..." : "Create Flight"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
                          <div className="h-6 w-6 rounded-full bg-[#4C0519] text-white flex items-center justify-center text-sm mr-3">
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
                            <Dialog open={addWineDialogOpen} onOpenChange={setAddWineDialogOpen}>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="flex items-center"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Wine
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                  <DialogTitle>Add Wine to Flight</DialogTitle>
                                  <DialogDescription>
                                    Add a new wine to "{flight.name}". You can search the Vinaturel database or add a custom wine.
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <WineForm 
                                  flightId={flight.id} 
                                  onSubmit={handleAddWine}
                                  isSubmitting={addWineMutation.isPending}
                                />
                              </DialogContent>
                            </Dialog>
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
                  className="bg-[#4C0519] hover:bg-[#3A0413]"
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
              className="bg-[#4C0519] hover:bg-[#3A0413]"
              onClick={handleFinish}
              disabled={!flights || flights.length === 0 || flights.some(f => !f.wines || f.wines.length === 0)}
            >
              Next: Review & Launch
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
