import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Tasting,
  Flight,
  ScoringRule
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Wine, CheckCircle, PencilLine, TimerIcon, Grape, Globe, MapPin, Building, Tag, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WineCard from "@/components/wine/wine-card";

export default function Summary() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: tasting, isLoading: tastingLoading } = useQuery<Tasting>({
    queryKey: [`/api/tastings/${tastingId}`],
  });

  const { data: flights, isLoading: flightsLoading } = useQuery<Flight[]>({
    queryKey: [`/api/tastings/${tastingId}/flights`],
  });

  const { data: scoringRules, isLoading: scoringLoading } = useQuery<ScoringRule>({
    queryKey: [`/api/tastings/${tastingId}/scoring`],
  });

  const activateTastingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/tastings/${tastingId}/status`, { status: "active" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}`] });
      toast({
        title: "Tasting activated",
        description: "Your tasting is now live and participants can join!",
      });
      navigate(`/host/dashboard/${tastingId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to activate tasting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (tastingLoading || flightsLoading || scoringLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#4C0519]" />
      </div>
    );
  }

  if (!tasting || !flights || !scoringRules) {
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

  const totalWines = flights.reduce((total, flight) => total + (flight.wines?.length || 0), 0);

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <Card className="border-none shadow-lg">
          <CardHeader className="border-b bg-gray-50 rounded-t-lg">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-display text-[#4C0519]">Tasting Summary</CardTitle>
                <CardDescription>
                  Review and launch your tasting: "{tasting.name}"
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center">1</div>
                <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center">2</div>
                <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center">3</div>
                <div className="w-8 h-8 rounded-full bg-[#4C0519] text-white flex items-center justify-center">4</div>
                <span className="text-xs text-gray-500 hidden sm:inline">Summary</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="py-6 space-y-6">
            <section>
              <h3 className="text-lg font-medium mb-3">Tasting Details</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Tasting Name</p>
                    <p className="font-medium">{tasting.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tasting Type</p>
                    <div className="flex items-center">
                      {tasting.isPublic ? (
                        tasting.password ? (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                            Password Protected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                            Public
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200">
                          Private (Invite Only)
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge variant="outline" className="bg-gray-100 text-gray-800">Draft</Badge>
                  </div>
                </div>
                <div className="mt-4">
                  <Button 
                    variant="link" 
                    className="text-[#4C0519] p-0 h-auto flex items-center" 
                    onClick={() => navigate(`/host/create`)}
                  >
                    <PencilLine className="h-4 w-4 mr-1" />
                    Edit Details
                  </Button>
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-medium mb-3">Scoring System</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center text-sm">
                      <Globe className="h-4 w-4 text-gray-500 mr-1" />
                      <span>Country:</span>
                      <span className="ml-auto font-medium">{scoringRules.country} pts</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <MapPin className="h-4 w-4 text-gray-500 mr-1" />
                      <span>Region:</span>
                      <span className="ml-auto font-medium">{scoringRules.region} pts</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Building className="h-4 w-4 text-gray-500 mr-1" />
                      <span>Producer:</span>
                      <span className="ml-auto font-medium">{scoringRules.producer} pts</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center text-sm">
                      <Tag className="h-4 w-4 text-gray-500 mr-1" />
                      <span>Wine Name:</span>
                      <span className="ml-auto font-medium">{scoringRules.wineName} pts</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 text-gray-500 mr-1" />
                      <span>Vintage:</span>
                      <span className="ml-auto font-medium">{scoringRules.vintage} pts</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Grape className="h-4 w-4 text-gray-500 mr-1" />
                      <span>Varietals:</span>
                      <span className="ml-auto font-medium">{scoringRules.varietals} pts</span>
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <div className="text-sm bg-gray-100 p-3 rounded-md">
                      <p className="font-medium mb-1">Additional Settings:</p>
                      <ul className="space-y-1">
                        <li className="flex items-center">
                          <CheckCircle className={`h-4 w-4 mr-1 ${scoringRules.anyVarietalPoint ? 'text-green-500' : 'text-gray-400'}`} />
                          <span>Award points for any correct varietal</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className={`h-4 w-4 mr-1 ${scoringRules.displayCount ? 'text-green-500' : 'text-gray-400'}`} />
                          <span>
                            {scoringRules.displayCount 
                              ? `Show top ${scoringRules.displayCount} on leaderboard` 
                              : 'Show all participants on leaderboard'}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <Button 
                    variant="link" 
                    className="text-[#4C0519] p-0 h-auto flex items-center" 
                    onClick={() => navigate(`/host/scoring/${tastingId}`)}
                  >
                    <PencilLine className="h-4 w-4 mr-1" />
                    Edit Scoring
                  </Button>
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-medium mb-3">Flights & Wines</h3>
              <div className="space-y-4">
                {flights.length > 0 ? (
                  <Accordion type="multiple" defaultValue={flights.map(f => f.id.toString())}>
                    {flights.map((flight, flightIndex) => (
                      <AccordionItem key={flight.id} value={flight.id.toString()}>
                        <AccordionTrigger className="hover:bg-gray-50 px-4 rounded-md">
                          <div className="flex items-center">
                            <div className="h-6 w-6 rounded-full bg-[#4C0519] text-white flex items-center justify-center text-sm mr-3">
                              {flightIndex + 1}
                            </div>
                            <div className="text-left">
                              <p className="font-medium">{flight.name}</p>
                              <div className="flex items-center text-sm text-gray-500">
                                <Wine className="h-4 w-4 mr-1" />
                                <span>{flight.wines?.length || 0} wines</span>
                                <TimerIcon className="h-4 w-4 ml-3 mr-1" />
                                <span>{Math.floor(flight.timeLimit / 60)} min timer</span>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {flight.wines?.map((wine) => (
                              <WineCard 
                                key={wine.id}
                                wine={wine}
                                isHost={true}
                              />
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Wine className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No flights created yet</p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => navigate(`/host/wines/${tastingId}`)}
                    >
                      Add flights and wines
                    </Button>
                  </div>
                )}
                <div>
                  <Button 
                    variant="link" 
                    className="text-[#4C0519] p-0 h-auto flex items-center" 
                    onClick={() => navigate(`/host/wines/${tastingId}`)}
                  >
                    <PencilLine className="h-4 w-4 mr-1" />
                    Edit Flights & Wines
                  </Button>
                </div>
              </div>
            </section>
          </CardContent>

          <CardFooter className="bg-gray-50 rounded-b-lg border-t flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/host/wines/${tastingId}`)}
            >
              Back
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="bg-[#4C0519] hover:bg-[#3A0413]"
                  disabled={!flights.length || !totalWines || activateTastingMutation.isPending}
                >
                  {activateTastingMutation.isPending ? "Activating..." : "Launch Tasting"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ready to launch your tasting?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Once launched, your tasting will be visible to participants and they can start joining.
                    You'll be able to control when each flight starts.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => activateTastingMutation.mutate()}
                    className="bg-[#4C0519] hover:bg-[#3A0413]"
                  >
                    Launch Tasting
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
