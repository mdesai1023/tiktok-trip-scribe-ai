
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Clock, Save, Calendar, ExternalLink } from "lucide-react";

interface ItineraryProps {
  itinerary: {
    id: string;
    title: string;
    location: string;
    duration: string;
    videoUrl: string;
    transcription: string;
    itinerary: Array<{
      day: number;
      title: string;
      activities: string[];
    }>;
    createdAt: string;
  };
  onSave: () => void;
}

const ItineraryDisplay = ({ itinerary, onSave }: ItineraryProps) => {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="p-6 shadow-lg border-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">{itinerary.title}</h2>
            <div className="flex flex-wrap items-center gap-4 text-blue-100">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{itinerary.location}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{itinerary.duration}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(itinerary.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(itinerary.videoUrl, '_blank')}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              View Video
            </Button>
          </div>
        </div>
      </Card>

      {/* Transcription Card */}
      <Card className="p-6 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">AI Analysis</h3>
        <p className="text-gray-600 leading-relaxed">{itinerary.transcription}</p>
      </Card>

      {/* Itinerary Cards */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-800">Your Detailed Itinerary</h3>
        {itinerary.itinerary && itinerary.itinerary.map((day, index) => (
          <Card key={day.day} className="p-6 shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Badge variant="secondary" className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg px-3 py-1">
                  Day {day.day}
                </Badge>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">{day.title}</h4>
                <div className="space-y-2">
                  {day.activities.map((activity, activityIndex) => (
                    <div key={activityIndex} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-600">{activity}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ItineraryDisplay;
