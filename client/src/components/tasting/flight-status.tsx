import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Wine } from "@shared/schema";
import FlightTimer from "@/components/flight/flight-timer";
import { CheckCircle2, Clock, Wine as WineIcon } from "lucide-react";

interface Flight {
  id: number;
  tastingId: number;
  name: string;
  orderIndex: number;
  timeLimit: number;
  startedAt: string | null;
  completedAt: string | null;
  wines: Wine[];
}

interface Participant {
  id: number;
  tastingId: number;
  userId: number;
  joinedAt: string;
  score: number;
}

interface Guess {
  id: number;
  participantId: number;
  wineId: number;
}

interface FlightStatusProps {
  tastingId: number;
  flight: Flight;
  currentUserId: number;
  isHost: boolean;
  onFlightComplete?: () => void;
}

export default function FlightStatus({ tastingId, flight, currentUserId, isHost, onFlightComplete }: FlightStatusProps) {
  const { toast } = useToast();

  const { data: participants, isLoading: participantsLoading } = useQuery<Participant[]>({
    queryKey: [`/api/tastings/${tastingId}/participants`],
  });

  const getParticipantStatus = () => {
    if (participantsLoading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          ))}
        </div>
      );
    }

    if (!participants || participants.length === 0) {
      return (
        <div className="text-center py-4">
          <WineIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No participants yet</p>
        </div>
      );
    }

    // In a real app, we would query guesses for each participant
    // For now, we'll simulate partially for display purposes
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm font-medium text-gray-500 border-b pb-2">
          <span>Participant</span>
          <span>Status</span>
        </div>
        {participants.map((participant, index) => {
          // Simulated data - in a real app, we would query actual guesses
          const guessedCount = Math.floor(Math.random() * (flight.wines.length + 1));
          const isDone = guessedCount === flight.wines.length;
          
          return (
            <div key={participant.id} className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium mr-2">
                  {participant.user?.name?.charAt(0) || '?'}
                </div>
                <span className="text-sm">
                  {participant.user?.name || `Participant ${index + 1}`}
                  {participant.userId === currentUserId && <span className="ml-1 text-xs">(You)</span>}
                </span>
              </div>
              
              <div className="flex items-center">
                {flight.completedAt ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </span>
                ) : flight.startedAt ? (
                  isDone ? (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Submitted
                    </span>
                  ) : (
                    <span className="text-xs">
                      {guessedCount} of {flight.wines.length} guessed
                    </span>
                  )
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    Waiting
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <WineIcon className="h-5 w-5 mr-2 text-[#4C0519]" />
          {flight.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FlightTimer
          flightId={flight.id}
          timeLimit={flight.timeLimit}
          startedAt={flight.startedAt}
          completedAt={flight.completedAt}
          isHost={isHost}
          onComplete={onFlightComplete}
        />
        
        <div className="pt-2">
          <div className="mb-2 text-sm font-medium">Wines in this flight:</div>
          <div className="flex flex-wrap gap-2">
            {flight.wines.map((wine) => (
              <div key={wine.id} className="flex items-center bg-gray-100 rounded-full px-3 py-1 text-sm">
                <span className="h-5 w-5 flex items-center justify-center bg-[#4C0519] text-white rounded-full text-xs font-medium mr-1.5">
                  {wine.letterCode}
                </span>
                {isHost ? wine.name : `Wine ${wine.letterCode}`}
              </div>
            ))}
            
            {flight.wines.length === 0 && (
              <div className="text-gray-500 text-sm">No wines added yet</div>
            )}
          </div>
        </div>
        
        <div className="pt-2">
          <div className="mb-2 text-sm font-medium">Participant Status:</div>
          {getParticipantStatus()}
        </div>
      </CardContent>
    </Card>
  );
}
