import { Wine } from "@shared/schema";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Database, Globe, MapPin, Building, Tag, Calendar, Grape } from "lucide-react";

interface WineCardProps {
  wine: Wine;
  showDetails?: boolean;
  isHost?: boolean;
}

export default function WineCard({ wine, showDetails = false, isHost = false }: WineCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-[#F9F5F6]">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <span className="h-8 w-8 flex items-center justify-center bg-[#4C0519] text-white rounded-full text-sm font-medium mr-3">
              {wine.letterCode}
            </span>
            {isHost ? wine.name : `Wine ${wine.letterCode}`}
          </CardTitle>
          
          {wine.isCustom ? (
            <Badge variant="outline" className="bg-gray-100">Custom</Badge>
          ) : (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center">
              <Database className="h-3 w-3 mr-1" />
              Vinaturel
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {showDetails || isHost ? (
          <div className="space-y-2">
            <div className="flex items-start">
              <Globe className="h-4 w-4 text-gray-500 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium">Country</p>
                <p className="text-sm text-gray-600">{wine.country}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <MapPin className="h-4 w-4 text-gray-500 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium">Region</p>
                <p className="text-sm text-gray-600">{wine.region}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <Building className="h-4 w-4 text-gray-500 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium">Producer</p>
                <p className="text-sm text-gray-600">{wine.producer}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <Tag className="h-4 w-4 text-gray-500 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium">Wine Name</p>
                <p className="text-sm text-gray-600">{wine.name}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <Calendar className="h-4 w-4 text-gray-500 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium">Vintage</p>
                <p className="text-sm text-gray-600">{wine.vintage}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <Grape className="h-4 w-4 text-gray-500 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium">Grape Varietals</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {wine.varietals.map((varietal, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {varietal}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="rounded-full bg-[#F9F5F6] p-4 mb-4">
                    <svg className="h-10 w-10 text-[#4C0519]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C11.1 2 10 2.9 10 4V6H14V4C14 2.9 12.9 2 12 2ZM7 7C5.9 7 5 7.9 5 9V15C5 18.3 7.7 21 11 21H13C16.3 21 19 18.3 19 15V9C19 7.9 18.1 7 17 7H7Z" fill="currentColor"/>
                    </svg>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Submit your guess for this wine</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-center text-gray-500">
              Wine details will be revealed after the flight is completed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
