import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User } from "lucide-react";
import RankedAvatar from "@/components/tasting/ranked-avatar";

interface Participant {
  id: number;
  tastingId: number;
  userId: number;
  score: number;
  joinedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    company?: string;
    profileImage?: string | null;
  };
}

interface LeaderboardProps {
  tastingId: number;
  displayCount?: number | null;
  currentUserId?: number;
  onSelectParticipant?: (participant: Participant) => void;
}

export default function Leaderboard({ tastingId, displayCount, currentUserId, onSelectParticipant }: LeaderboardProps) {
  const { data: participants, isLoading } = useQuery<Participant[]>({
    queryKey: [`/api/tastings/${tastingId}/participants`],
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  const medalBg = (rank: number) => (
    rank === 1 ? "bg-[#FFF9DB]" : rank === 2 ? "bg-gray-100" : rank === 3 ? "bg-[#FFECDD]" : "bg-white"
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bestenliste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center space-x-4 p-3 border rounded-md">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!participants || participants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bestenliste</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Noch keine Teilnehmer</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort participants by score, highest first
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);
  
  // Limit to display count if provided
  const displayedParticipants = displayCount ? sortedParticipants.slice(0, displayCount) : sortedParticipants;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bestenliste</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayedParticipants.map((participant, index) => {
          const rank = index + 1;
          const isCurrentUser = participant.user.id === currentUserId;
          
          return (
            <div 
              key={participant.id} 
              className={`
                p-3 rounded-md border flex items-center space-x-3
                ${medalBg(rank)}
                ${isCurrentUser ? 'ring-2 ring-[#274E37] ring-opacity-50' : ''}
                ${onSelectParticipant ? 'cursor-pointer hover:opacity-90' : ''}
              `}
              onClick={() => onSelectParticipant && onSelectParticipant(participant)}
            >
              <RankedAvatar
                imageUrl={participant.user.profileImage}
                name={participant.user.name}
                rank={rank}
                sizeClass="h-12 w-12"
              />
              
              <div className="flex-1">
                <div className="flex items-center">
                  <p className="font-medium">
                    {participant.user.name}
                    {isCurrentUser && <span className="ml-2 text-xs">(Sie)</span>}
                  </p>
                </div>
                <p className="text-xs opacity-70">
                  Beigetreten am {new Date(participant.joinedAt).toLocaleDateString()}
                </p>
              </div>
              
              <Badge className={`
                font-bold
                ${rank === 1 ? 'bg-[#FFD700] text-white' : ''}
                ${rank === 2 ? 'bg-[#C0C0C0] text-white' : ''}
                ${rank === 3 ? 'bg-[#CD7F32] text-white' : ''}
                ${rank > 3 ? 'bg-gray-200 text-gray-800' : ''}
              `}>
                {participant.score} Pkt
              </Badge>
            </div>
          );
        })}
        
        {displayCount && sortedParticipants.length > displayCount && (
          <div className="text-center pt-2 text-sm text-gray-500">
            Zeige Top {displayCount} von {sortedParticipants.length} Teilnehmern
          </div>
        )}
      </CardContent>
    </Card>
  );
}
