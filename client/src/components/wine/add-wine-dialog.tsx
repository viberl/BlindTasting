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
import { countries as COUNTRY_LIST, countryToRegions } from "@/data/country-regions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import VarietalCombobox from "@/components/wine/varietal-combobox";
import { Checkbox } from "@/components/ui/checkbox";

// Define schema for custom wine creation
const customWineSchema = z
  .object({
    name: z.string().min(1, "Name ist erforderlich"),
    producer: z.string().min(1, "Produzent ist erforderlich"),
    country: z.string().min(1, "Land ist erforderlich"),
    region: z.string().min(1, "Region ist erforderlich"),
    vintage: z.string().optional(),
    noVintage: z.boolean().default(false),
    varietals: z.array(z.string()).min(1, "Mindestens eine Rebsorte ist erforderlich").max(3, "Maximal 3 Rebsorten"),
  })
  .refine(
    (data) => data.noVintage || (!!data.vintage && /^\d{4}$/.test(String(data.vintage))),
    { path: ["vintage"], message: "Bitte 4-stelligen Jahrgang eingeben" }
  );

type CustomWineFormData = z.infer<typeof customWineSchema>;

// Define schema for API wine search
const searchSchema = z.object({
  query: z.string().min(1, "Suchbegriff ist erforderlich"),
});

type SearchFormData = z.infer<typeof searchSchema>;

// Interface for wine data from vinaturel API
interface VinaturelWine {
  id: string | number;
  name: string;
  producer: string;
  country: string;
  region: string;
  vintage: string | number;
  varietals: string[];
  varietal1?: string;
  varietal2?: string | null;
  varietal3?: string | null;
  price?: number;
  imageUrl?: string | null;
  description?: string;
  articleNumber?: string;
  externalId?: string;
  volumeMl?: number | null;
  productUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AddWineDialogProps {
  flightId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWineAdded?: () => void;
  refetchFlights?: () => Promise<any>;
}

export default function AddWineDialog({ flightId, open, onOpenChange, onWineAdded, refetchFlights }: AddWineDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchMode, setSearchMode] = useState<"vinaturel" | "custom">("vinaturel");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWine, setSelectedWine] = useState<VinaturelWine | null>(null);

  // Form for custom wine creation
  const customForm = useForm<CustomWineFormData>({
    resolver: zodResolver(customWineSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      producer: "",
      country: "",
      region: "",
      vintage: "",
      noVintage: false,
      varietals: [],
    },
  });

  const selectedCountry = customForm.watch("country");
  const availableRegions = selectedCountry ? countryToRegions[selectedCountry] || [] : [];

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
  } = useQuery({
    queryKey: ["vinaturel-wines", searchQuery],
    queryFn: async (): Promise<{ data: VinaturelWine[] }> => {
      if (!searchQuery) return { data: [] };
      const res = await apiRequest("GET", `/api/vinaturel/search?q=${encodeURIComponent(searchQuery)}`);
      const json = await res.json();
      // Return the data in the expected format
      return { data: json.data?.data || [] };
    },
    enabled: searchQuery.length > 0,
  });

  // Mutation for adding a wine to the flight
  const addWineMutation = useMutation({
    mutationFn: async (wineData: any) => {
      const response = await apiRequest("POST", `/api/flights/${flightId}/wines`, wineData);
      return response.json();
    },
    onSuccess: async (newWine) => {
      toast({
        title: "Wein hinzugefügt",
        description: "Der Wein wurde erfolgreich zum Flight hinzugefügt",
      });
      if (refetchFlights) {
        await refetchFlights();
      }
      if (onWineAdded) onWineAdded();
      console.log("Wine added successfully:", newWine);
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
    if (data.query.trim()) {
      setSearchQuery(data.query);
      // Clear previous results before new search
      queryClient.setQueryData(["vinaturel-wines", data.query], { data: [] });
      refetch();
    }
  };

  // Handle custom wine submission
  const onCustomSubmit = (data: CustomWineFormData) => {
    addWineMutation.mutate({
      ...data,
      vintage: data.noVintage ? "Kein Jahrgang" : String(data.vintage || ""),
      varietals: data.varietals,
      isCustom: true,
    });
  };

  // Handle vinaturel wine selection
  const onVinaturelSelect = () => {
    if (!selectedWine) return;

    // Create varietals array from available sources
    let varietals = Array.isArray(selectedWine.varietals) 
      ? selectedWine.varietals 
      : [
          selectedWine.varietal1,
          selectedWine.varietal2,
          selectedWine.varietal3
        ].filter(Boolean) as string[];
    // limit to max 3 varietals
    varietals = varietals.slice(0, 3);

    addWineMutation.mutate({
      name: selectedWine.name,
      producer: selectedWine.producer,
      country: selectedWine.country,
      region: selectedWine.region,
      vintage: String(selectedWine.vintage),
      varietals: varietals,
      vinaturelId:
        (selectedWine.articleNumber && String(selectedWine.articleNumber)) ||
        (selectedWine.externalId && String(selectedWine.externalId)) ||
        (selectedWine.id ? String(selectedWine.id) : undefined),
      articleNumber: selectedWine.articleNumber,
      externalId: selectedWine.externalId || String(selectedWine.id),
      volumeMl: selectedWine.volumeMl,
      productUrl: selectedWine.productUrl,
      imageUrl: selectedWine.imageUrl,
      isCustom: false
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
                  className="bg-[#4C0274E37519] hover:bg-[#3A0413]"
                  disabled={isSearching}
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Suchen"}
                </Button>
              </form>
            </Form>

            <div className="h-[300px] overflow-y-auto border rounded-md p-2">
              {isSearching ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-[#274E37]" />
                </div>
              ) : searchResults?.data && searchResults.data.length > 0 ? (
                <div className="grid gap-2">
                  {searchResults.data.map((wine: VinaturelWine) => {
                    // Debug-Ausgabe
                    console.log('Rendering wine:', wine);
                    return (
                      <Card 
                        key={wine.id} 
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedWine?.id === wine.id ? 'border-[#4C05274E3719] border-2' : ''}`}
                        onClick={() => setSelectedWine(wine)}
                      >
                        <CardContent className="p-3 flex items-start gap-3">
                          {wine.imageUrl ? (
                            <div className="h-16 w-10 overflow-hidden flex-shrink-0">
                              <img 
                                src={wine.imageUrl} 
                                alt={wine.name}
                                className="w-full h-full object-cover object-bottom"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  // Fallback zum Wein-Icon, wenn das Bild nicht geladen werden kann
                                  const fallback = document.createElement('div');
                                  fallback.className = 'h-10 w-10 flex items-center justify-center bg-[#4C0519] text-white flex-shrink-0';
                                  const icon = document.createElement('wine-icon');
                                  icon.className = 'h-5 w-5';
                                  fallback.appendChild(icon);
                                  target.parentNode?.insertBefore(fallback, target.nextSibling);
                                }}
                              />
                            </div>
                          ) : (
                            <div className="h-10 w-10 flex items-center justify-center bg-[#4C0519] text-white rounded-full flex-shrink-0">
                              <WineIcon className="h-5 w-5" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="font-medium">{wine.producer} {wine.name}</div>
                            <div className="text-sm text-gray-500">
                              {wine.region}, {wine.country}, {wine.vintage}
                              {wine.articleNumber && (
                                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                  Art.-Nr.: {wine.articleNumber}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Array.isArray(wine.varietals) && wine.varietals.map((varietal: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">{varietal}</Badge>
                              ))}
                              {!wine.varietals && wine.varietal1 && (
                                <Badge variant="outline" className="text-xs">{wine.varietal1}</Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
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
                        <Select
                          value={field.value || ""}
                          onValueChange={(val) => {
                            field.onChange(val);
                            // reset region when country changes
                            customForm.setValue("region", "");
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Land auswählen" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRY_LIST.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <Select
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          disabled={!selectedCountry}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Region auswählen" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableRegions.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                    <FormField
                      control={customForm.control}
                      name="vintage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jahrgang</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="z.B. 2018"
                              value={field.value || ""}
                              onChange={(e) => {
                                const onlyDigits = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                                field.onChange(onlyDigits);
                              }}
                              disabled={customForm.watch("noVintage")}
                              inputMode="numeric"
                              pattern="[0-9]{4}"
                              title="Bitte genau 4 Ziffern eingeben"
                              maxLength={4}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={customForm.control}
                      name="noVintage"
                      render={({ field }) => (
                        <FormItem className="mb-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(v) => {
                                const checked = Boolean(v);
                                field.onChange(checked);
                                if (checked) customForm.setValue("vintage", "");
                              }}
                              id="noVintage"
                            />
                            <label htmlFor="noVintage" className="text-sm leading-none">
                              Kein Jahrgang
                            </label>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={customForm.control}
                    name="varietals"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rebsorten (max. 3)</FormLabel>
                        <VarietalCombobox
                          value={field.value || []}
                          onChange={field.onChange}
                          maxSelected={3}
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(field.value || []).map((v: string) => (
                            <Badge key={v} variant="secondary">{v}</Badge>
                          ))}
                        </div>
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
