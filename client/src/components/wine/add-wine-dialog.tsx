import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { InsertWine, insertWineSchema } from '@shared/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import VinaturelWineSelector from './vinaturel-wine-selector';

interface AddWineDialogProps {
  flightId: number;
  onWineAdded?: () => void;
  trigger?: React.ReactNode;
  selectedWineIds?: string[];
}

// The wine form schema
const customWineSchema = insertWineSchema.omit({ flightId: true, letterCode: true });

export default function AddWineDialog({ 
  flightId, 
  onWineAdded, 
  trigger,
  selectedWineIds = []
}: AddWineDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('vinaturel');
  const { toast } = useToast();

  const form = useForm<z.infer<typeof customWineSchema>>({
    resolver: zodResolver(customWineSchema),
    defaultValues: {
      name: '',
      producer: '',
      country: '',
      region: '',
      vintage: '',
      varietals: [],
    },
  });

  const createWineMutation = useMutation({
    mutationFn: async (data: Omit<InsertWine, 'letterCode'>) => {
      const res = await apiRequest('POST', `/api/flights/${flightId}/wines`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/flights/${flightId}/wines`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tastings`] });
      toast({
        title: 'Wine added',
        description: 'The wine has been added to the flight.',
      });
      form.reset();
      setOpen(false);
      if (onWineAdded) {
        onWineAdded();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add wine',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: z.infer<typeof customWineSchema>) => {
    createWineMutation.mutate({
      ...data,
      flightId,
    });
  };

  const handleVinaturelWineSelect = (wineData: Omit<InsertWine, 'flightId' | 'letterCode'>) => {
    createWineMutation.mutate({
      ...wineData,
      flightId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-[#4C0519] hover:bg-[#3A0413]">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Wine
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Add Wine to Flight</DialogTitle>
          <DialogDescription>
            Select from Vinaturel's catalog or add a custom wine to this flight.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="vinaturel" value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vinaturel">Vinaturel Catalog</TabsTrigger>
            <TabsTrigger value="custom">Custom Wine</TabsTrigger>
          </TabsList>

          <TabsContent value="vinaturel" className="mt-4">
            <VinaturelWineSelector 
              onSelectWine={handleVinaturelWineSelect} 
              selectedWines={selectedWineIds}
            />
          </TabsContent>

          <TabsContent value="custom" className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wine Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Reserva Especial" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. France" {...field} />
                        </FormControl>
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
                        <FormControl>
                          <Input placeholder="e.g. Bordeaux" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vintage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vintage</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 2018" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="varietals"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Varietals (comma separated)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. Cabernet Sauvignon, Merlot" 
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value.split(',').map(item => item.trim()).filter(Boolean));
                            }}
                            value={field.value.join(', ')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter className="mt-6">
                  <Button
                    type="submit"
                    className="bg-[#4C0519] hover:bg-[#3A0413]"
                    disabled={createWineMutation.isPending}
                  >
                    {createWineMutation.isPending ? 'Adding...' : 'Add Custom Wine'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}