import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { 
  Tasting,
  Flight,
  ScoringRule
} from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, Users, Calendar, ClipboardList, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FlightStatus from "@/components/tasting/flight-status";
import Leaderboard from "@/components/tasting/leaderboard";
import WineCard from "@/components/wine/wine-card";

export default function HostDashboard() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("current");
  const [selectedFlightIndex, setSelectedFlightIndex] = useState(0);

  const { data: tasting, isLoading: tastingLoading } = useQuery<Tasting>({
    queryKey: [`/api/tastings/${tastingId}`],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const { data: flights, isLoading: flightsLoading } = useQuery<Flight[]>({
    queryKey: [`/api/tastings/${tastingId}/flights`],
    refetchInterval: 10000, // Refetch every 10 seconds
    onSuccess: (data) => {
      // Find the current active flight (started but not completed)
      const activeFlightIndex = data.findIndex(flight => flight.startedAt && !flight.completedAt);
      if (activeFlightIndex >= 0) {
        setSelectedFlightIndex(activeFlightIndex);
      }
    }
  });

  const { data: scoringRules } = useQuery<ScoringRule>({
    queryKey: [`/api/tastings/${tastingId}/scoring`],
  });

  // Handle flight completion
  const handleFlightComplete = () => {
    // Move to the next flight if available
    if (flights && selectedFlightIndex < flights.length - 1) {
      setSelectedFlightIndex(selectedFlightIndex + 1);
    }
  };

  // Copy join link to clipboard
  const copyJoinLink = () => {
    const joinLink = `${window.location.origin}/tasting/${tastingId}`;
    navigator.clipboard.writeText(joinLink);
    toast({
      title: "Join link copied",
      description: "The link has been copied to your clipboard.",
    });
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

  // Check if user is the host
  if (tasting.hostId !== user?.id) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Unauthorized</h2>
          <p className="mt-2">You are not the host of this tasting.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const statusBadge = () => {
    switch (tasting.status) {
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "active":
        return <Badge variant="success" className="bg-green-100 text-green-800">Active</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return null;
    }
  };

  const selectedFlight = flights && flights[selectedFlightIndex];
  const getCompletedFlights = () => flights?.filter(flight => flight.completedAt) || [];

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Card className="border-none shadow-lg mb-8">
          <CardHeader className="border-b bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-2xl font-display text-[#4C0519]">{tasting.name}</CardTitle>
                  {statusBadge()}
                </div>
                <CardDescription>
                  Host Dashboard - Manage your tasting and participants
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  className="flex items-center" 
                  onClick={copyJoinLink}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Copy Join Link
                </Button>
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
                  <Users className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">
                    {tasting.isPublic 
                      ? (tasting.password ? "Password protected" : "Public tasting") 
                      : "Private (invite only)"}
                  </span>
                </div>
                <div className="flex items-center">
                  <ClipboardList className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">
                    {flights?.length || 0} flights, {flights?.reduce((total, flight) => total + (flight.wines?.length || 0), 0) || 0} wines total
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="current">Current Flight</TabsTrigger>
                <TabsTrigger value="completed">Completed Flights</TabsTrigger>
              </TabsList>

              <TabsContent value="current" className="space-y-6">
                {selectedFlight ? (
                  <>
                    <FlightStatus
                      tastingId={tastingId}
                      flight={selectedFlight}
                      currentUserId={user.id}
                      isHost={true}
                      onFlightComplete={handleFlightComplete}
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
                            className={selectedFlightIndex === index ? "bg-[#4C0519] hover:bg-[#3A0413]" : ""}
                          >
                            Flight {index + 1}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Wine Cards */}
                    {selectedFlight.wines && selectedFlight.wines.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Wines in this Flight</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {selectedFlight.wines.map((wine) => (
                            <WineCard 
                              key={wine.id}
                              wine={wine}
                              isHost={true}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-800 mb-2">No Flights Available</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-6">
                      There are no flights configured for this tasting, or all flights have been completed.
                    </p>
                    <Button 
                      onClick={() => navigate(`/host/wines/${tastingId}`)}
                      className="bg-[#4C0519] hover:bg-[#3A0413]"
                    >
                      Add Flights & Wines
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-6">
                {getCompletedFlights().length > 0 ? (
                  <>
                    <h3 className="text-lg font-medium">Completed Flights</h3>
                    <div className="space-y-4">
                      {getCompletedFlights().map((flight) => (
                        <Card key={flight.id}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-md">{flight.name}</CardTitle>
                            <CardDescription>
                              Completed on {flight.completedAt ? new Date(flight.completedAt).toLocaleString() : 'N/A'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {flight.wines?.map((wine) => (
                                <div key={wine.id} className="bg-gray-50 rounded p-2 text-sm">
                                  <div className="font-medium">{wine.letterCode}: {wine.name}</div>
                                  <div className="text-gray-500">{wine.producer}, {wine.vintage}</div>
                                  <div className="text-gray-500">{wine.country}, {wine.region}</div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-800 mb-2">No Completed Flights</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      None of the flights in this tasting have been completed yet.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <Leaderboard 
              tastingId={tastingId} 
              displayCount={scoringRules?.displayCount || null}
              currentUserId={user.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
