import { Wine } from "@shared/schema";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Globe,
  MapPin,
  Building,
  Calendar,
  Grape,
  Wine as WineIcon
} from "lucide-react";

interface WineCardProps {
  wine: Wine;
  isHost: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function WineCard({ wine, isHost, onClick, isSelected }: WineCardProps) {
  return (
    <Card 
      className={`overflow-hidden transition-all ${
        onClick ? "cursor-pointer hover:shadow-md" : ""
      } ${isSelected ? "border-[#4C0519] ring-1 ring-[#4C0519]" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2 flex items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#4C0519] text-white font-medium rounded-full w-6 h-6 flex items-center justify-center text-sm">
              {wine.letterCode}
            </span>
            {isHost ? (
              <CardTitle className="text-lg">{wine.name}</CardTitle>
            ) : (
              <CardTitle className="text-lg">Wine {wine.letterCode}</CardTitle>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isHost ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-start">
              <Building className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
              <span>{wine.producer || "Unknown producer"}</span>
            </div>
            
            <div className="flex items-start">
              <Globe className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
              <span>{wine.country || "Unknown country"}</span>
            </div>
            
            <div className="flex items-start">
              <MapPin className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
              <span>{wine.region || "Unknown region"}</span>
            </div>
            
            <div className="flex items-start">
              <Calendar className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
              <span>Vintage: {wine.vintage || "Unknown"}</span>
            </div>
            
            <div className="flex items-start">
              <Grape className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
              <div className="flex flex-wrap gap-1">
                {wine.varietals && wine.varietals.length > 0 ? (
                  wine.varietals.map((varietal, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {varietal}
                    </Badge>
                  ))
                ) : (
                  <span className="text-gray-500">No varietals specified</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <WineIcon className="h-12 w-12 text-[#4C0519]/20" />
          </div>
        )}
      </CardContent>
      
      {!isHost && (
        <CardFooter className="pt-0 pb-3">
          <p className="text-center text-sm text-muted-foreground w-full">
            Details will be revealed after the flight is completed
          </p>
        </CardFooter>
      )}
    </Card>
  );
}