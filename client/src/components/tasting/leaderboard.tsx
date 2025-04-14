import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Medal, User } from "lucide-react";

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
  };
}

interface LeaderboardProps {
  tastingId: number;
  displayCount?: number | null;
  currentUserId?: number;
}

export default function Leaderboard({ tastingId, displayCount, currentUserId }: LeaderboardProps) {
  const { data: participants, isLoading } = useQuery<Participant[]>({
    queryKey: [`/api/tastings/${tastingId}/participants`],
  });

  const getRankColor = (rank: number): string => {
    switch (rank) {
      case 1: return "bg-gold-100 border-gold-200 text-gold-800";
      case 2: return "bg-gray-100 border-gray-200 text-gray-600";
      case 3: return "bg-vine-100 border-vine-200 text-vine-800";
      default: return "bg-white border-gray-200";
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Award className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Award className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-700" />;
      default:
        return <Medal className="h-5 w-5 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Leaderboard</CardTitle>
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
          <CardTitle className="text-lg">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No participants yet</p>
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
        <CardTitle className="text-lg">Leaderboard</CardTitle>
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
                ${getRankColor(rank)}
                ${isCurrentUser ? 'ring-2 ring-[#4C0519] ring-opacity-50' : ''}
              `}
            >
              <div className={`
                h-8 w-8 flex items-center justify-center rounded-full 
                ${rank <= 3 ? 'bg-white' : 'bg-gray-200 text-gray-600'}
                text-sm font-medium
              `}>
                {getRankIcon(rank)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center">
                  <p className="font-medium">
                    {participant.user.name}
                    {isCurrentUser && <span className="ml-2 text-xs">(You)</span>}
                  </p>
                </div>
                <p className="text-xs opacity-70">
                  Joined {new Date(participant.joinedAt).toLocaleDateString()}
                </p>
              </div>
              
              <Badge className={`
                ${rank === 1 ? 'bg-yellow-500' : rank === 2 ? 'bg-gray-400' : rank === 3 ? 'bg-amber-700' : 'bg-gray-200'}
                text-white font-bold
              `}>
                {participant.score} pts
              </Badge>
            </div>
          );
        })}
        
        {displayCount && sortedParticipants.length > displayCount && (
          <div className="text-center pt-2 text-sm text-gray-500">
            Showing top {displayCount} of {sortedParticipants.length} participants
          </div>
        )}
      </CardContent>
    </Card>
  );
}
