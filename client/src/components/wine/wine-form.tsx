import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Wine, Database } from "lucide-react";
import { InsertWine } from "@shared/schema";

const wineFormSchema = z.object({
  country: z.string().min(1, "Country is required"),
  region: z.string().min(1, "Region is required"),
  producer: z.string().min(1, "Producer is required"),
  name: z.string().min(1, "Wine name is required"),
  vintage: z.string().min(1, "Vintage is required"),
  varietals: z.array(z.string()).min(1, "At least one varietal is required"),
  vinaturelId: z.string().optional(),
  isCustom: z.boolean().default(true),
});

type WineFormData = z.infer<typeof wineFormSchema>;

interface WineFormProps {
  flightId: number;
  onSubmit: (data: Omit<InsertWine, "letterCode">) => void;
  isSubmitting: boolean;
}

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

export default function WineForm({ flightId, onSubmit, isSubmitting }: WineFormProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("custom");
  const [selectedVarietals, setSelectedVarietals] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const form = useForm<WineFormData>({
    resolver: zodResolver(wineFormSchema),
    defaultValues: {
      country: "",
      region: "",
      producer: "",
      name: "",
      vintage: "",
      varietals: [],
      isCustom: true,
    },
  });

  // Vinaturel API Weinsuche
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["/api/wines/search", searchQuery],
    queryFn: () => {
      if (!searchQuery || searchQuery.length < 3) return [];
      return fetch(`/api/wines/search?q=${encodeURIComponent(searchQuery)}`).then(res => res.json());
    },
    enabled: searchQuery.length >= 3,
  });

  useEffect(() => {
    const country = form.watch("country");
    if (country && regions[country as keyof typeof regions]) {
      setAvailableRegions(regions[country as keyof typeof regions]);
    } else {
      setAvailableRegions([]);
    }
  }, [form.watch("country")]);

  const addVarietal = (varietal: string) => {
    if (!selectedVarietals.includes(varietal) && selectedVarietals.length < 3) {
      const newVarietals = [...selectedVarietals, varietal];
      setSelectedVarietals(newVarietals);
      form.setValue("varietals", newVarietals);
    }
  };

  const removeVarietal = (varietal: string) => {
    const newVarietals = selectedVarietals.filter(v => v !== varietal);
    setSelectedVarietals(newVarietals);
    form.setValue("varietals", newVarietals);
  };

  const handleSelectVinaturelWine = (wine: any) => {
    form.setValue("country", wine.country);
    form.setValue("region", wine.region);
    form.setValue("producer", wine.producer);
    form.setValue("name", wine.name);
    form.setValue("vintage", wine.vintage);
    form.setValue("varietals", wine.varietals);
    form.setValue("vinaturelId", wine.id);
    form.setValue("isCustom", false);
    setSelectedVarietals(wine.varietals);
    setActiveTab("custom"); // Switch to custom tab to display the selected wine
  };

  const handleFormSubmit = (data: WineFormData) => {
    onSubmit({
      flightId,
      country: data.country,
      region: data.region,
      producer: data.producer,
      name: data.name,
      vintage: data.vintage,
      varietals: data.varietals,
      vinaturelId: data.vinaturelId,
      isCustom: data.isCustom,
    });
    
    // Reset form
    form.reset({
      country: "",
      region: "",
      producer: "",
      name: "",
      vintage: "",
      varietals: [],
      vinaturelId: undefined,
      isCustom: true,
    });
    setSelectedVarietals([]);
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="custom" className="flex items-center">
            <Wine className="mr-2 h-4 w-4" />
            <span>Add Custom Wine</span>
          </TabsTrigger>
          <TabsTrigger value="vinaturel" className="flex items-center">
            <Database className="mr-2 h-4 w-4" />
            <span>Search Vinaturel</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="custom">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                      <FormLabel>Region</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!form.watch("country")}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableRegions.map(region => (
                            <SelectItem key={region} value={region}>{region}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="producer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Producer/Winery</FormLabel>
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
                    <FormLabel>Wine Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Grand Vin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vintage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vintage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vintage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(year => (
                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="varietals"
                  render={() => (
                    <FormItem>
                      <FormLabel>Rebsorten (max. 3)</FormLabel>
                      <Select 
                        onValueChange={(value) => addVarietal(value)}
                        disabled={selectedVarietals.length >= 3}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedVarietals.length >= 3 ? "Max. 3 Rebsorten" : "Rebsorte hinzufügen"} />
                          </SelectTrigger>
                        </FormControl>
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
                      {selectedVarietals.length === 0 && (
                        <p className="text-sm text-gray-500 mt-2">Bitte mindestens eine Rebsorte auswählen</p>
                      )}
                      {selectedVarietals.length >= 3 && (
                        <p className="text-sm text-amber-600 mt-2">Maximale Anzahl an Rebsorten erreicht (3)</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-[#4C0519] hover:bg-[#3A0413]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Adding Wine..." : "Add Wine to Flight"}
              </Button>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="vinaturel">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input 
                placeholder="Search wines from Vinaturel..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="border rounded-md min-h-[200px] max-h-[300px] overflow-y-auto p-2">
              {searchLoading && <p className="text-center py-10 text-gray-500">Searching...</p>}
              
              {!searchLoading && searchQuery.length < 3 && (
                <p className="text-center py-10 text-gray-500">Enter at least 3 characters to search</p>
              )}
              
              {!searchLoading && searchQuery.length >= 3 && (!searchResults || searchResults.length === 0) && (
                <p className="text-center py-10 text-gray-500">Keine Weine gefunden für "{searchQuery}"</p>
              )}
              
              {!searchLoading && searchQuery.length >= 3 && searchResults && searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((wine: any) => (
                    <div 
                      key={wine.id} 
                      className="border rounded p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSelectVinaturelWine(wine)}
                    >
                      <div className="flex justify-between">
                        <h4 className="font-medium">{wine.name}</h4>
                        <span className="text-gray-500">{wine.vintage}</span>
                      </div>
                      <p className="text-sm text-gray-600">{wine.producer}</p>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{wine.country}, {wine.region}</span>
                        <span>{wine.varietals.join(", ")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
