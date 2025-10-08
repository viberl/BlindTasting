import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Tasting,
  Flight as BaseFlight,
  ScoringRule,
  Participant,
  Wine
} from "@shared/schema";
import { fetchScoringRules } from "@/lib/scoring-rules";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Loader2, Calendar, Lock, User, Wine as WineIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FlightStatus from "@/components/tasting/flight-status";
import Leaderboard from "@/components/tasting/leaderboard";

export default function TastingDetails() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [passwordInput, setPasswordInput] = useState("");
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [selectedFlightIndex, setSelectedFlightIndex] = useState(0);

  const { data: tasting, isLoading: tastingLoading } = useQuery<Tasting>({
    queryKey: [`/api/tastings/${tastingId}`],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  type Flight = BaseFlight & { wines: Wine[] };

  const { data: flights, isLoading: flightsLoading } = useQuery<Flight[]>({
    queryKey: [`/api/tastings/${tastingId}/flights`],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  useEffect(() => {
    if (flights && flights.length > 0) {
      const activeFlightIndex = flights.findIndex(flight => flight.startedAt && !flight.completedAt);
      if (activeFlightIndex >= 0) {
        setSelectedFlightIndex(activeFlightIndex);
      }
    }
  }, [flights]);

  const { data: scoringRules } = useQuery<ScoringRule | null>({
    queryKey: [`/api/tastings/${tastingId}/scoring`],
    queryFn: () => fetchScoringRules(tastingId),
    enabled: Number.isFinite(tastingId) && tastingId > 0,
  });

  const { data: participants, isLoading: participantsLoading } = useQuery<Participant[]>({
    queryKey: [`/api/tastings/${tastingId}/participants`],
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const joinTastingMutation = useMutation({
    mutationFn: async (data: { password?: string }) => {
      const res = await apiRequest("POST", `/api/tastings/${tastingId}/join`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/participants`] });
      toast({
        title: "Joined tasting",
        description: "You've successfully joined this tasting.",
      });
      setJoinDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to join tasting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if user is already a participant
  const isParticipant = participants?.some(p => p.userId === user?.id);

  // Handle joining the tasting
  const handleJoin = () => {
    if (tasting?.isPublic && !tasting.password) {
      // Public tasting - join directly
      joinTastingMutation.mutate({});
    } else if (tasting?.isPublic && tasting.password) {
      // Password protected - show password dialog
      setJoinDialogOpen(true);
    } else {
      // Private tasting - join directly (backend will verify if user is invited)
      joinTastingMutation.mutate({});
    }
  };

  // Handle submitting password
  const handlePasswordSubmit = () => {
    joinTastingMutation.mutate({ password: passwordInput });
  };

  // Navigate to submit guesses page
  const handleSubmitGuesses = () => {
    if (flights && flights[selectedFlightIndex]) {
      navigate(`/tasting/${tastingId}/submit?flight=${flights[selectedFlightIndex].id}`);
    }
  };

  if (tastingLoading || flightsLoading || participantsLoading) {
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

  // Check if tasting is active
  if (tasting.status !== "active") {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-amber-600">Tasting not active</h2>
          <p className="mt-2">This tasting is not currently active. Please check back later.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const selectedFlight = flights && flights[selectedFlightIndex];
  const canSubmitGuesses = isParticipant && selectedFlight?.startedAt && !selectedFlight?.completedAt;

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Card className="border-none shadow-lg mb-8">
          <CardHeader className="border-b bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-2xl font-display text-[#274E37]">{tasting.name}</CardTitle>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
                </div>
                <CardDescription>
                  {isParticipant 
                    ? "You are participating in this tasting" 
                    : "Join this tasting to participate"}
                </CardDescription>
              </div>
              <div>
                {!isParticipant ? (
                  <Button
                    className="bg-[#274E37] hover:bg-[#e65b2d]"
                    onClick={handleJoin}
                    disabled={joinTastingMutation.isPending}
                  >
                    {joinTastingMutation.isPending ? "Joining..." : "Join Tasting"}
                  </Button>
                ) : canSubmitGuesses ? (
                  <Button
                    className="bg-[#274E37] hover:bg-[#e65b2d]"
                    onClick={handleSubmitGuesses}
                  >
                    Submit Guesses
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">
                    Created on {new Date(tasting.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center">
                  <Lock className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">
                    {tasting.isPublic 
                      ? (tasting.password ? "Password protected" : "Public tasting") 
                      : "Private (invite only)"}
                  </span>
                </div>
                <div className="flex items-center">
                  <User className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">
                    Hosted by {/* Host name would be shown here */}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {selectedFlight ? (
              <>
                <FlightStatus
                  tastingId={tastingId}
                  flight={selectedFlight}
                  currentUserId={user?.id ?? 0}
                  isHost={false}
                />

                {/* Flight Selection Pills */}
                {flights && flights.length > 1 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {flights.map((flight, index) => (
                      <Button
                        key={flight.id}
                        variant={selectedFlightIndex === index ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedFlightIndex(index)}
                        className={selectedFlightIndex === index ? "bg-[#274E37] hover:bg-[#e65b2d]" : ""}
                      >
                        Flight {index + 1}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Submit guesses button */}
                {isParticipant && selectedFlight.startedAt && !selectedFlight.completedAt && (
                  <Card className="mt-6">
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center text-center space-y-4">
                        <WineIcon className="h-12 w-12 text-[#274E37]" />
                        <div>
                          <h3 className="text-xl font-medium">Ready to submit your guesses?</h3>
                          <p className="text-gray-500 mt-2">
                            Submit your guesses for the wines in this flight before the timer runs out.
                          </p>
                        </div>
                        <Button
                          className="bg-[#274E37] hover:bg-[#e65b2d] mt-2"
                          onClick={handleSubmitGuesses}
                        >
                          Submit Guesses
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Completed flight results */}
                {selectedFlight.completedAt && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="text-lg">Flight Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {selectedFlight.wines?.map((wine) => (
                          <div key={wine.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center mb-2">
                              <span className="h-6 w-6 flex items-center justify-center bg-[#274E37] text-white rounded-full text-sm font-medium mr-2">
                                {wine.letterCode}
                              </span>
                              <h4 className="font-medium">{wine.name}</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>Country: <span className="font-medium">{wine.country}</span></div>
                              <div>Region: <span className="font-medium">{wine.region}</span></div>
                              <div>Producer: <span className="font-medium">{wine.producer}</span></div>
                              <div>Vintage: <span className="font-medium">{wine.vintage}</span></div>
                              <div className="col-span-2">
                                Varietals: 
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {wine.varietals.map((varietal, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {varietal}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              {/* User's guess would be shown here in a real app */}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium text-gray-800 mb-2">No Active Flight</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-6">
                  There is no active flight at the moment. The host will start the first flight soon.
                </p>
              </div>
            )}
          </div>

          <div>
            <Leaderboard 
              tastingId={tastingId} 
              displayCount={scoringRules?.displayCount || null}
              currentUserId={user?.id}
            />
          </div>
        </div>
      </div>

      {/* Password Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Tasting Password</DialogTitle>
            <DialogDescription>
              This tasting is password protected. Please enter the password to join.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePasswordSubmit}
              disabled={!passwordInput || joinTastingMutation.isPending}
              className="bg-[#274E37] hover:bg-[#e65b2d]"
            >
              {joinTastingMutation.isPending ? "Joining..." : "Join"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
