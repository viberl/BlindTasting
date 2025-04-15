import { useState } from "react";
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
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const flightSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  timeLimit: z.coerce.number().min(1, "Zeit muss mindestens 1 Minute sein").max(180, "Zeit darf maximal 180 Minuten sein"),
});

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
    defaultValues: {
      name: "",
      timeLimit: 30,
    },
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
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name des Flights</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Rotweine aus Burgund" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timeLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zeitlimit (Minuten)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={180} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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