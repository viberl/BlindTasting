import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Clock, Play, Square, AlertTriangle } from "lucide-react";

interface FlightTimerProps {
  flightId: number;
  timeLimit: number; // in seconds
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  isHost: boolean;
  onComplete?: () => void;
}

export default function FlightTimer({ flightId, timeLimit, startedAt, completedAt, isHost, onComplete }: FlightTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(timeLimit);
  const [isActive, setIsActive] = useState<boolean>(!!startedAt && !completedAt);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Calculate initial time remaining
  useEffect(() => {
    if (startedAt && !completedAt) {
      const startTime = new Date(startedAt as any).getTime();
      const now = new Date().getTime();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, timeLimit - elapsedSeconds);
      setTimeRemaining(remaining);
      setIsActive(true);
    } else if (completedAt) {
      setTimeRemaining(0);
      setIsActive(false);
    } else {
      setTimeRemaining(timeLimit);
      setIsActive(false);
    }
  }, [startedAt, completedAt, timeLimit]);

  // Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((time) => {
          if (time <= 1) {
            clearInterval(interval as NodeJS.Timeout);
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    } else if (isActive && timeRemaining === 0) {
      setIsActive(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeRemaining]);

  const startFlightMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/flights/${flightId}/start`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tastings`] });
      setIsActive(true);
    },
    onError: (error: Error) => {
      console.error('Failed to start flight:', error.message);
    },
  });

  const completeFlightMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/flights/${flightId}/complete`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tastings`] });
      setIsActive(false);
      setTimeRemaining(0);
      
      if (onComplete) {
        onComplete();
      }
    },
    onError: (error: Error) => {
      console.error('Failed to complete flight:', error.message);
    },
  });

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    return ((timeLimit - timeRemaining) / timeLimit) * 100;
  };

  const getProgressColor = (): string => {
    const percentage = (timeRemaining / timeLimit) * 100;
    if (percentage > 60) return "bg-green-500";
    if (percentage > 30) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handleStart = () => {
    startFlightMutation.mutate();
  };

  const handleComplete = () => {
    if (timeRemaining > 0) {
      setShowCompleteConfirm(true);
    } else {
      completeFlightMutation.mutate();
    }
  };

  if (completedAt) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-gray-500 mr-2" />
              <span className="font-medium">Flight abgeschlossen</span>
            </div>
            <span className="text-sm text-gray-500">
              Abgeschlossen um {new Date(completedAt).toLocaleTimeString()}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-gray-500 mr-2" />
                <span className="font-medium">Flight-Timer</span>
              </div>
              <div className={`text-2xl font-bold ${timeRemaining < 60 ? 'text-red-600' : ''}`}>
                {formatTime(timeRemaining)}
              </div>
            </div>
            
            <Progress 
              value={getProgressPercentage()} 
              className="h-2"
              indicatorClassName={getProgressColor()}
            />
            
            {isHost && (
              <div className="flex space-x-2 pt-2">
                {!startedAt && (
                  <Button 
                    onClick={handleStart}
                    className="w-full flex items-center"
                    disabled={startFlightMutation.isPending}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {startFlightMutation.isPending ? "Startet..." : "Flight starten"}
                  </Button>
                )}
                
                {startedAt && !completedAt && (
                  <Button 
                    onClick={handleComplete}
                    variant="outline"
                    className="w-full flex items-center"
                    disabled={completeFlightMutation.isPending}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    {completeFlightMutation.isPending ? "Schließt ab..." : "Flight abschließen"}
                  </Button>
                )}
              </div>
            )}
            
            {!isHost && startedAt && !completedAt && (
              <p className="text-sm text-gray-500 text-center">
                Flight läuft. Geben Sie Ihre Tipps ab, bevor die Zeit abläuft!
              </p>
            )}
            
            {!isHost && !startedAt && (
              <p className="text-sm text-gray-500 text-center">
                Warten auf den Veranstalter, um diesen Flight zu starten...
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
              Flight vorzeitig beenden?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Es ist noch Zeit auf dem Flight-Timer übrig. Möchten Sie den Flight wirklich jetzt beenden? Alle Weine werden angezeigt und die Punkte berechnet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => completeFlightMutation.mutate()}>
              Ja, Flight abschließen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
