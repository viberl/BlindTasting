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
import { useEffect, useState } from "react";

interface WineCardProps {
  wine: Wine;
  isHost: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function WineCard({ wine, isHost, onClick, isSelected }: WineCardProps) {
  // Verwende die bereits in der Datenbank gespeicherte imageUrl
  const imageUrl = wine.imageUrl || null;
  return (
    <Card 
      className={`overflow-hidden transition-all ${
        onClick ? "cursor-pointer hover:shadow-md" : ""
      } ${isSelected ? "border-[#274E37] ring-1 ring-[#274E37]" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2 flex items-start">
        <div className="w-full">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {imageUrl ? (
                <div className="w-12 h-20 overflow-hidden">
                  <img 
                    src={imageUrl} 
                    alt={wine.name}
                    className="w-full h-full object-cover object-bottom"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="w-12 h-12 bg-[#274E37] text-white font-medium flex items-center justify-center text-sm">
                  {wine.letterCode}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {isHost ? (
                <>
                  <div className="text-sm font-medium">{wine.producer || 'Unbekanntes Weingut'}</div>
                  <CardTitle className="text-lg">{wine.name}</CardTitle>
                  {wine.vinaturelId && (
                    <div className="text-xs text-muted-foreground">Art.Nr. {wine.vinaturelId}</div>
                  )}
                </>
              ) : (
                <CardTitle className="text-lg">Wein {wine.letterCode}</CardTitle>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isHost ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-start">
              <Building className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
              <span>{wine.producer || "Unbekanntes Weingut"}</span>
            </div>
            
            <div className="flex items-start">
              <Globe className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
              <span>{wine.country || "Unbekanntes Land"}</span>
            </div>
            
            <div className="flex items-start">
              <MapPin className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
              <span>{wine.region || "Unbekannte Region"}</span>
            </div>
            
            <div className="flex items-start">
              <Calendar className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
              <span>Jahrgang: {wine.vintage || "Unbekannt"}</span>
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
                  <span className="text-gray-500">Keine Rebsorten angegeben</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <WineIcon className="h-12 w-12 text-[#274E37]/20" />
          </div>
        )}
      </CardContent>
      
      {!isHost && (
        <CardFooter className="pt-0 pb-3">
          <p className="text-center text-sm text-muted-foreground w-full">
            Details werden nach Abschluss des Flights angezeigt
          </p>
        </CardFooter>
      )}
    </Card>
  );
}
