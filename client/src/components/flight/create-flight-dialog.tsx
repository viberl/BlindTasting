import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Flight ist einfach eine Runde ohne zusätzliche Eigenschaften
const flightSchema = z.object({});

type FlightFormData = z.infer<typeof flightSchema>;

interface CreateFlightDialogProps {
  tastingId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateFlightDialog({ tastingId, open, onOpenChange }: CreateFlightDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<FlightFormData>({
    resolver: zodResolver(flightSchema),
    defaultValues: {},
  });

  const createFlightMutation = useMutation({
    mutationFn: async (data: FlightFormData) => {
      const response = await apiRequest("POST", `/api/tastings/${tastingId}/flights`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Flight erstellt",
        description: "Der Flight wurde erfolgreich erstellt",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/flights`] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Erstellen des Flights: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FlightFormData) => {
    createFlightMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neuen Flight erstellen</DialogTitle>
          <DialogDescription>
            Erstellen Sie einen neuen Flight für diese Verkostung. Ein Flight ist eine Runde von Weinen, die gleichzeitig verkostet werden.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-center mb-4">
              Ein Flight ist eine Runde von Weinen, die gleichzeitig verkostet werden. 
              Sie können nach dem Erstellen des Flights Weine hinzufügen.
            </p>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                className="bg-[#4C0519] hover:bg-[#3A0413]"
                disabled={createFlightMutation.isPending}
              >
                {createFlightMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird erstellt...
                  </>
                ) : (
                  "Flight erstellen"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}