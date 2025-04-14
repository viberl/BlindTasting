import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Tasting,
  Flight,
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
import { useToast } from "@/hooks/use-toast";
import FlightTimer from "@/components/flight/flight-timer";

// Mock data for dropdowns - in a real app, these would come from an API
const countries = ["France", "Italy", "Spain", "Germany", "United States", "Australia", "Argentina", "Chile", "Portugal", "South Africa"];
const regions = {
  "France": ["Bordeaux", "Burgundy", "Champagne", "Rhône Valley", "Loire Valley", "Alsace", "Provence"],
  "Italy": ["Tuscany", "Piedmont", "Veneto", "Sicily", "Lombardy", "Puglia"],
  "Spain": ["Rioja", "Ribera del Duero", "Priorat", "Rías Baixas", "Jerez"],
  "Germany": ["Mosel", "Rheingau", "Pfalz", "Baden", "Rheinhessen"],
  "United States": ["Napa Valley", "Sonoma", "Willamette Valley", "Central Coast", "Washington"]
};
const varietals = [
  "Cabernet Sauvignon", "Merlot", "Pinot Noir", "Syrah/Shiraz", "Zinfandel", 
  "Grenache", "Tempranillo", "Sangiovese", "Nebbiolo", "Malbec",
  "Chardonnay", "Sauvignon Blanc", "Riesling", "Pinot Grigio", "Gewürztraminer"
];

// Create guess schema
const guessSchema = z.object({
  country: z.string().optional(),
  region: z.string().optional(),
  producer: z.string().optional(),
  name: z.string().optional(),
  vintage: z.string().optional(),
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

  // Get flight ID from URL query parameter
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const flightId = parseInt(searchParams.get('flight') || '0');

  const [selectedWineId, setSelectedWineId] = useState<number | null>(null);
  const [selectedVarietals, setSelectedVarietals] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  // Queries
  const { data: tasting, isLoading: tastingLoading } = useQuery<Tasting>({
    queryKey: [`/api/tastings/${tastingId}`],
  });

  const { data: flights, isLoading: flightsLoading } = useQuery<Flight[]>({
    queryKey: [`/api/tastings/${tastingId}/flights`],
  });

  const { data: participants, isLoading: participantsLoading } = useQuery<Participant[]>({
    queryKey: [`/api/tastings/${tastingId}/participants`],
    onSuccess: (data) => {
      const currentParticipant = data.find(p => p.userId === user?.id);
      if (currentParticipant) {
        setCurrentParticipantId(currentParticipant.id);
      }
    }
  });

  const [currentParticipantId, setCurrentParticipantId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");

  // Get the current flight
  const currentFlight = flights?.find(f => f.id === flightId);

  // Set up form with react-hook-form
  const form = useForm<GuessFormData>({
    resolver: zodResolver(guessSchema),
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
    if (country && regions[country as keyof typeof regions]) {
      setAvailableRegions(regions[country as keyof typeof regions]);
    } else {
      setAvailableRegions([]);
    }
  }, [form.watch("country")]);

  // Set first wine as selected on load
  useEffect(() => {
    if (currentFlight?.wines && currentFlight.wines.length > 0 && !selectedWineId) {
      setSelectedWineId(currentFlight.wines[0].id);
      setActiveTab(currentFlight.wines[0].letterCode);
    }
  }, [currentFlight, selectedWineId]);

  // Submit guess mutation
  const submitGuessMutation = useMutation({
    mutationFn: async (data: InsertGuess) => {
      const res = await apiRequest("POST", `/api/wines/${selectedWineId}/guess`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Guess submitted",
        description: `Your guess for Wine ${currentFlight?.wines.find(w => w.id === selectedWineId)?.letterCode} has been saved.`,
      });
      
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
        title: "Failed to submit guess",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle adding and removing varietals
  const addVarietal = (varietal: string) => {
    if (!selectedVarietals.includes(varietal)) {
      const newVarietals = [...selectedVarietals, varietal];
      setSelectedVarietals(newVarietals);
    }
  };

  const removeVarietal = (varietal: string) => {
    const newVarietals = selectedVarietals.filter(v => v !== varietal);
    setSelectedVarietals(newVarietals);
  };

  // Handle form submission
  const onSubmit = (formData: GuessFormData) => {
    if (!currentParticipantId || !selectedWineId) {
      toast({
        title: "Error",
        description: "Unable to submit guess. Please try again.",
        variant: "destructive",
      });
      return;
    }

    submitGuessMutation.mutate({
      ...formData,
      participantId: currentParticipantId,
      wineId: selectedWineId,
      varietals: selectedVarietals,
    });
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const selectedWine = currentFlight?.wines.find(w => w.letterCode === value);
    if (selectedWine) {
      setSelectedWineId(selectedWine.id);
    }
  };

  // Handle completing the flight and returning to tasting details
  const handleFinish = () => {
    navigate(`/tasting/${tastingId}`);
  };

  // Loading state
  if (tastingLoading || flightsLoading || participantsLoading || !currentFlight) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#4C0519]" />
      </div>
    );
  }

  // Check if user is a participant
  if (!participants?.some(p => p.userId === user?.id)) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Not a participant</h2>
          <p className="mt-2">You are not participating in this tasting.</p>
          <Button className="mt-4" onClick={() => navigate(`/tasting/${tastingId}`)}>
            Return to Tasting
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
          <h2 className="text-2xl font-bold text-amber-600">Flight not active</h2>
          <p className="mt-2">This flight is not currently active.</p>
          <Button className="mt-4" onClick={() => navigate(`/tasting/${tastingId}`)}>
            Return to Tasting
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
                  <CardTitle className="text-2xl font-display text-[#4C0519]">Submit Your Guesses</CardTitle>
                </div>
                <CardDescription>
                  {currentFlight.name}
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Time remaining</p>
                <FlightTimer
                  flightId={currentFlight.id}
                  timeLimit={currentFlight.timeLimit}
                  startedAt={currentFlight.startedAt}
                  completedAt={currentFlight.completedAt}
                  isHost={false}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="py-6">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
              <TabsList className="flex-wrap">
                {currentFlight.wines.map((wine) => (
                  <TabsTrigger key={wine.id} value={wine.letterCode} className="flex items-center space-x-2">
                    <span className="h-6 w-6 flex items-center justify-center bg-[#4C0519] text-white rounded-full text-sm font-medium">
                      {wine.letterCode}
                    </span>
                    <span>Wine {wine.letterCode}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {currentFlight.wines.map((wine) => (
                <TabsContent key={wine.id} value={wine.letterCode} className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4 flex items-center">
                    <span className="h-10 w-10 flex items-center justify-center bg-[#4C0519] text-white rounded-full text-lg font-medium mr-3">
                      {wine.letterCode}
                    </span>
                    <h3 className="text-lg font-medium text-gray-900">Wine {wine.letterCode}</h3>
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
                                  Country
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a country" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="">Select a country</SelectItem>
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
                                      <SelectValue placeholder="Select a region" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="">Select a region</SelectItem>
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
                                  Producer/Winery
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Château Margaux" {...field} />
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
                                  Wine Name
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Grand Vin" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="vintage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center">
                                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                                  Vintage
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a year" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="">Select a year</SelectItem>
                                    {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div>
                            <FormLabel className="flex items-center">
                              <Grape className="h-4 w-4 mr-2 text-muted-foreground" />
                              Grape Varietals
                            </FormLabel>
                            <Select onValueChange={addVarietal}>
                              <SelectTrigger>
                                <SelectValue placeholder="Add varietals" />
                              </SelectTrigger>
                              <SelectContent>
                                {varietals.map(varietal => (
                                  <SelectItem key={varietal} value={varietal}>{varietal}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                                  Your Rating (88-100)
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
                                  Rate this wine on a scale from 88 to 100
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
                                <FormLabel>Tasting Notes</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Aromas of black cherry, tobacco and cedar..." 
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
                          Return to Tasting
                        </Button>
                        <Button 
                          type="submit" 
                          className="bg-[#4C0519] hover:bg-[#3A0413]"
                          disabled={submitGuessMutation.isPending}
                        >
                          {submitGuessMutation.isPending 
                            ? "Submitting..." 
                            : `Submit Guess for Wine ${wine.letterCode}`}
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
