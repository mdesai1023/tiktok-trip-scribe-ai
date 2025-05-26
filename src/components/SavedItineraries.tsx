
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Calendar, Eye, Bookmark } from "lucide-react";

interface SavedItinerariesProps {
  itineraries: Array<{
    id: number;
    title: string;
    location: string;
    duration: string;
    videoUrl: string;
    createdAt: string;
  }>;
  onSelect: (itinerary: any) => void;
}

const SavedItineraries = ({ itineraries, onSelect }: SavedItinerariesProps) => {
  if (itineraries.length === 0) {
    return (
      <Card className="p-8 text-center shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <Bookmark className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No saved itineraries</h3>
        <p className="text-gray-500">Your saved travel plans will appear here</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-gray-800">Your Saved Trips</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {itineraries.map((itinerary) => (
          <Card
            key={itinerary.id}
            className="p-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">{itinerary.title}</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{itinerary.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{itinerary.duration}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(itinerary.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelect(itinerary)}
                className="w-full hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <Eye className="w-4 h-4 mr-1" />
                View Details
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SavedItineraries;
