import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";

interface SetTimerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightId: number;
}

export default function SetTimerDialog({ open, onOpenChange, flightId }: SetTimerDialogProps) {
  const [minutes, setMinutes] = useState(10); // Default-Wert: 10 Minuten
  const { toast } = useToast();

  const setTimerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/flights/${flightId}/timer`, { minutes });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tastings"] });
      toast({
        title: "Timer gestartet",
        description: `Der Timer wurde auf ${minutes} Minuten eingestellt.`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler beim Starten des Timers",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (minutes <= 0) {
      toast({
        title: "Ungültige Zeit",
        description: "Die Zeit muss größer als 0 sein.",
        variant: "destructive",
      });
      return;
    }
    setTimerMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Timer einstellen</DialogTitle>
          <DialogDescription>
            Stelle einen Timer für diesen Flight ein. Der Flight wird automatisch beendet, wenn die Zeit abgelaufen ist.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="minutes" className="text-sm font-medium">
                  Minuten
                </Label>
                <Input
                  id="minutes"
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
                  min="1"
                  max="60"
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="submit"
              disabled={setTimerMutation.isPending}
              className="w-full"
            >
              {setTimerMutation.isPending ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Starte Timer...
                </>
              ) : (
                "Timer starten"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}