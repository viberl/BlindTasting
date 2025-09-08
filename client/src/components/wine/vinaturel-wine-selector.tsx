import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wine, Search, X } from 'lucide-react';
import { InsertWine } from '@shared/schema';

interface VinaturelWine {
  id: string;
  name: string;
  producer: string;
  country: string;
  region: string;
  vintage: string | number;
  varietals: string[];
  price: number;
  imageUrl?: string;
  description?: string;
}

interface VinaturelWineSelectorProps {
  onSelectWine: (wine: Omit<InsertWine, 'flightId' | 'letterCode'>) => void;
  selectedWines?: string[]; // Array of selected wine IDs
}

export default function VinaturelWineSelector({ onSelectWine, selectedWines = [] }: VinaturelWineSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [filteredWines, setFilteredWines] = useState<VinaturelWine[]>([]);

  const { data: wines, isLoading, error } = useQuery<VinaturelWine[]>({
    queryKey: ['/api/vinaturel/wines', page],
    queryFn: async () => {
      const response = await fetch(`/api/vinaturel/wines?page=${page}&limit=20`);
      if (!response.ok) {
        throw new Error('Failed to fetch wines');
      }
      return response.json();
    },
  });

  // Filter wines based on search term
  useEffect(() => {
    if (!wines) return;

    const filtered = wines.filter(wine => {
      const searchLower = searchTerm.toLowerCase();
      return (
        wine.name.toLowerCase().includes(searchLower) ||
        wine.producer.toLowerCase().includes(searchLower) ||
        wine.country.toLowerCase().includes(searchLower) ||
        wine.region.toLowerCase().includes(searchLower) ||
        wine.varietals.some(varietal => varietal.toLowerCase().includes(searchLower))
      );
    });

    setFilteredWines(filtered);
  }, [wines, searchTerm]);

  const handleSelectWine = (wine: VinaturelWine) => {
    onSelectWine({
      name: wine.name,
      producer: wine.producer,
      country: wine.country,
      region: wine.region,
      vintage: wine.vintage.toString(),
      varietals: wine.varietals,
      vinaturelId: wine.id,
      isCustom: false
    });
  };

  const isWineSelected = (wineId: string) => {
    return selectedWines.includes(wineId);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search wines by name, producer, region..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-9 w-9"
            onClick={() => setSearchTerm('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#274E37]" />
        </div>
      ) : error ? (
        <div className="text-center p-8 text-red-500">
          <p>Error loading wines from Vinaturel.</p>
          <p className="text-sm">{(error as Error).message}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
          {filteredWines.length === 0 ? (
            <div className="col-span-full text-center p-8 text-gray-500">
              No wines found matching your search.
            </div>
          ) : (
            filteredWines.map((wine) => (
              <Card key={wine.id} className={`overflow-hidden hover:shadow-md transition-shadow ${isWineSelected(wine.id) ? 'border-[#274E37] bg-rose-50' : ''}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg line-clamp-2">{wine.name}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        {wine.vintage}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {wine.country}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {wine.region}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{wine.producer}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {wine.varietals.map((varietal, index) => (
                        <Badge key={index} className="bg-[#274E37]/10 text-[#274E37] hover:bg-[#274E37]/20 text-xs">
                          {varietal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant={isWineSelected(wine.id) ? "outline" : "default"}
                    className={`w-full ${isWineSelected(wine.id) ? 'border-[#274E37] text-[#274E37]' : 'bg-[#274E37] hover:bg-[#e65b2d]'}`}
                    onClick={() => handleSelectWine(wine)}
                    disabled={isWineSelected(wine.id)}
                  >
                    <Wine className="mr-2 h-4 w-4" />
                    {isWineSelected(wine.id) ? 'Already Added' : 'Add to Flight'}
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setPage(p => Math.max(p - 1, 1))}
          disabled={page === 1 || isLoading}
        >
          Previous
        </Button>
        <span className="flex items-center text-sm text-muted-foreground">
          Page {page}
        </span>
        <Button
          variant="outline"
          onClick={() => setPage(p => p + 1)}
          disabled={!wines || wines.length < 20 || isLoading}
        >
          Next
        </Button>
      </div>
    </div>
  );
}