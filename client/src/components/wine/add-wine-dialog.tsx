import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Wine as WineIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Define schema for custom wine creation
const customWineSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  producer: z.string().min(1, "Produzent ist erforderlich"),
  country: z.string().min(1, "Land ist erforderlich"),
  region: z.string().min(1, "Region ist erforderlich"),
  vintage: z.string().min(1, "Jahrgang ist erforderlich"),
  varietals: z.string().min(1, "Mindestens eine Rebsorte ist erforderlich"),
});

type CustomWineFormData = z.infer<typeof customWineSchema>;

// Define schema for API wine search
const searchSchema = z.object({
  query: z.string().min(1, "Suchbegriff ist erforderlich"),
});

type SearchFormData = z.infer<typeof searchSchema>;

// Interface for wine data from vinaturel API
interface VinaturelWine {
  id: string;
  name: string;
  producer: string;
  country: string;
  region: string;
  vintage: string | number;
  varietals: string[];
  price?: number;
  imageUrl?: string;
  description?: string;
}

interface AddWineDialogProps {
  flightId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddWineDialog({ flightId, open, onOpenChange }: AddWineDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchMode, setSearchMode] = useState<"vinaturel" | "custom">("vinaturel");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWine, setSelectedWine] = useState<VinaturelWine | null>(null);

  // Form for custom wine creation
  const customForm = useForm<CustomWineFormData>({
    resolver: zodResolver(customWineSchema),
    defaultValues: {
      name: "",
      producer: "",
      country: "",
      region: "",
      vintage: "",
      varietals: "",
    },
  });

  // Form for search functionality
  const searchForm = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: "",
    },
  });

  // Query for searching vinaturel wines
  const {
    data: searchResults,
    isLoading: isSearching,
    refetch,
  } = useQuery<{ wines: VinaturelWine[] }>({
    queryKey: ["/api/wines/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery) return { wines: [] };
      const res = await apiRequest("GET", `/api/wines/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.length > 0,
  });

  // Mutation for adding a wine to the flight
  const addWineMutation = useMutation({
    mutationFn: async (wineData: any) => {
      const response = await apiRequest("POST", `/api/flights/${flightId}/wines`, wineData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Wein hinzugefügt",
        description: "Der Wein wurde erfolgreich zum Flight hinzugefügt",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/tastings`, `/api/flights`] });
      customForm.reset();
      setSearchQuery("");
      setSelectedWine(null);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Hinzufügen des Weins: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle search submission
  const onSearchSubmit = (data: SearchFormData) => {
    setSearchQuery(data.query);
    refetch();
  };

  // Handle custom wine submission
  const onCustomSubmit = (data: CustomWineFormData) => {
    // Convert varietals string to array
    const varietalsArray = data.varietals.split(",").map(v => v.trim());
    
    addWineMutation.mutate({
      ...data,
      varietals: varietalsArray,
    });
  };

  // Handle vinaturel wine selection
  const onVinaturelSelect = () => {
    if (!selectedWine) return;

    addWineMutation.mutate({
      name: selectedWine.name,
      producer: selectedWine.producer,
      country: selectedWine.country,
      region: selectedWine.region,
      vintage: String(selectedWine.vintage),
      varietals: selectedWine.varietals,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Wein zum Flight hinzufügen</DialogTitle>
          <DialogDescription>
            Fügen Sie einen Wein zum Flight hinzu. Sie können einen Wein aus der Vinaturel-Datenbank auswählen oder einen eigenen Wein anlegen.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="vinaturel" className="w-full" onValueChange={(value) => setSearchMode(value as "vinaturel" | "custom")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vinaturel">Vinaturel Weine</TabsTrigger>
            <TabsTrigger value="custom">Eigener Wein</TabsTrigger>
          </TabsList>

          <TabsContent value="vinaturel" className="space-y-4 py-4">
            <Form {...searchForm}>
              <form onSubmit={searchForm.handleSubmit(onSearchSubmit)} className="flex gap-2 mb-4">
                <FormField
                  control={searchForm.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Suchen nach Name, Produzent, Region..." className="pl-8" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="bg-[#4C0519] hover:bg-[#3A0413]"
                  disabled={isSearching}
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Suchen"}
                </Button>
              </form>
            </Form>

            <div className="h-[300px] overflow-y-auto border rounded-md p-2">
              {isSearching ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-[#4C0519]" />
                </div>
              ) : searchResults?.wines && searchResults.wines.length > 0 ? (
                <div className="grid gap-2">
                  {searchResults.wines.map((wine) => (
                    <Card 
                      key={wine.id} 
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedWine?.id === wine.id ? 'border-[#4C0519] border-2' : ''}`}
                      onClick={() => setSelectedWine(wine)}
                    >
                      <CardContent className="p-3 flex items-start gap-3">
                        <div className="h-10 w-10 flex items-center justify-center bg-[#4C0519] text-white rounded-full flex-shrink-0">
                          <WineIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{wine.producer} {wine.name}</div>
                          <div className="text-sm text-gray-500">{wine.region}, {wine.country}, {wine.vintage}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {wine.varietals.map((varietal, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{varietal}</Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <WineIcon className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-muted-foreground">Keine Weine gefunden für "{searchQuery}"</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Search className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-muted-foreground">Geben Sie einen Suchbegriff ein, um Weine zu finden</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 py-4">
            <Form {...customForm}>
              <form onSubmit={customForm.handleSubmit(onCustomSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={customForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name des Weins</FormLabel>
                        <FormControl>
                          <Input placeholder="z.B. Réserve" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={customForm.control}
                    name="producer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produzent</FormLabel>
                        <FormControl>
                          <Input placeholder="z.B. Château Margaux" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={customForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Land</FormLabel>
                        <FormControl>
                          <Input placeholder="z.B. Frankreich" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={customForm.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <FormControl>
                          <Input placeholder="z.B. Bordeaux" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={customForm.control}
                    name="vintage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jahrgang</FormLabel>
                        <FormControl>
                          <Input placeholder="z.B. 2018" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={customForm.control}
                    name="varietals"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rebsorten</FormLabel>
                        <FormControl>
                          <Input placeholder="z.B. Cabernet Sauvignon, Merlot" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          {searchMode === "vinaturel" ? (
            <Button
              type="button"
              className="bg-[#4C0519] hover:bg-[#3A0413]"
              disabled={!selectedWine || addWineMutation.isPending}
              onClick={onVinaturelSelect}
            >
              {addWineMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird hinzugefügt...
                </>
              ) : (
                "Wein hinzufügen"
              )}
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-[#4C0519] hover:bg-[#3A0413]"
              disabled={!customForm.formState.isValid || addWineMutation.isPending}
              onClick={customForm.handleSubmit(onCustomSubmit)}
            >
              {addWineMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird hinzugefügt...
                </>
              ) : (
                "Wein hinzufügen"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}