import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Wine, 
  PlusCircle, 
  Calendar, 
  Users, 
  ClipboardList,
  Clock,
  Sparkles
} from "lucide-react";
import { Tasting } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

type TastingsResponse = {
  hosted: Tasting[];
  participating: Tasting[];
  available: Tasting[];
};

export default function HomePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  const { data: tastings, isLoading } = useQuery<TastingsResponse>({
    queryKey: ["/api/tastings"],
    refetchInterval: 10000, // Refetch every 10 seconds to keep data fresh
  });

  const handleCreateTasting = () => {
    navigate("/host/create");
  };

  const handleViewTasting = (tastingId: number, isHost: boolean) => {
    if (isHost) {
      navigate(`/host/dashboard/${tastingId}`);
    } else {
      navigate(`/tasting/${tastingId}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#4C0519] to-[#7F1D1D] text-white rounded-lg p-8 mb-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Welcome to BlindSip, {user?.name}!
          </h1>
          <p className="text-lg mb-6">
            Host or join wine blind tastings, challenge your palate, and discover new favorites.
          </p>
          <div className="flex space-x-4">
            <Button 
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
              onClick={handleCreateTasting}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Tasting
            </Button>
            <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/20">
              Browse Tastings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="hosted" className="space-y-6">
        <TabsList className="grid w-full md:w-auto grid-cols-3">
          <TabsTrigger value="hosted">Hosted Tastings</TabsTrigger>
          <TabsTrigger value="participating">Participating</TabsTrigger>
          <TabsTrigger value="available">Available</TabsTrigger>
        </TabsList>

        {/* Hosted Tastings */}
        <TabsContent value="hosted" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-display font-semibold">Your Hosted Tastings</h2>
            <Button onClick={handleCreateTasting}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Tasting
            </Button>
          </div>
          <Separator />
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-9 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : tastings?.hosted && tastings.hosted.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tastings.hosted.map((tasting) => (
                <Card key={tasting.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl font-display">{tasting.name}</CardTitle>
                      {getStatusBadge(tasting.status)}
                    </div>
                    <CardDescription>Created on {formatDate(tasting.createdAt)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{tasting.status === "completed" ? "Completed on " + formatDate(tasting.completedAt || "") : "In progress"}</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{tasting.isPublic ? "Public" : "Private"} tasting</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={() => handleViewTasting(tasting.id, true)}
                      className="w-full"
                      variant={tasting.status === "draft" ? "outline" : "default"}
                    >
                      {tasting.status === "draft" ? "Continue Setup" : "View Dashboard"}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Wine className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No hosted tastings yet</h3>
              <p className="mt-2 text-muted-foreground">Create your first tasting to get started</p>
              <Button onClick={handleCreateTasting} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Tasting
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Participating Tastings */}
        <TabsContent value="participating" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-display font-semibold">Tastings You're Participating In</h2>
          </div>
          <Separator />
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-9 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : tastings?.participating && tastings.participating.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tastings.participating.map((tasting) => (
                <Card key={tasting.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl font-display">{tasting.name}</CardTitle>
                      {getStatusBadge(tasting.status)}
                    </div>
                    <CardDescription>Host: {/* Host name would be fetched */}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{tasting.status === "completed" ? "Completed on " + formatDate(tasting.completedAt || "") : "In progress"}</span>
                      </div>
                      <div className="flex items-center">
                        <ClipboardList className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Your position: <span className="font-medium">-- / --</span></span>
                      </div>
                      <div className="flex items-center">
                        <Sparkles className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Your score: <span className="font-medium">--</span></span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={() => handleViewTasting(tasting.id, false)}
                      className="w-full"
                    >
                      Continue Tasting
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Not participating in any tastings</h3>
              <p className="mt-2 text-muted-foreground">Join a tasting or browse available tastings</p>
              <Button variant="outline" className="mt-4">
                Browse Tastings
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Available Tastings */}
        <TabsContent value="available" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-display font-semibold">Available Tastings</h2>
          </div>
          <Separator />
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-9 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : tastings?.available && tastings.available.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tastings.available.map((tasting) => (
                <Card key={tasting.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl font-display">{tasting.name}</CardTitle>
                      {getStatusBadge(tasting.status)}
                    </div>
                    <CardDescription>Host: {/* Host name would be fetched */}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{tasting.isPublic ? "Public" : "Private"} tasting</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Created on {formatDate(tasting.createdAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={() => handleViewTasting(tasting.id, false)}
                      className="w-full"
                    >
                      Join Tasting
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Wine className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No tastings available</h3>
              <p className="mt-2 text-muted-foreground">Check back later or create your own tasting</p>
              <Button onClick={handleCreateTasting} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Tasting
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
