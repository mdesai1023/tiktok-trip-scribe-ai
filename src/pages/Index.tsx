
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import VideoProcessor from "@/components/VideoProcessor";
import ItineraryDisplay from "@/components/ItineraryDisplay";
import SavedItineraries from "@/components/SavedItineraries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Video, Bookmark } from "lucide-react";

const Index = () => {
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [currentItinerary, setCurrentItinerary] = useState(null);
  const [savedItineraries, setSavedItineraries] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tiktokUrl.trim()) {
      toast({
        title: "Please enter a TikTok URL",
        description: "We need a valid TikTok link to process",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    // Simulate processing for now
    setTimeout(() => {
      const mockItinerary = {
        id: Date.now(),
        title: "Amazing Tokyo Adventure",
        location: "Tokyo, Japan",
        duration: "5 Days",
        videoUrl: tiktokUrl,
        transcription: "Exploring the vibrant streets of Tokyo, from traditional temples to modern districts...",
        itinerary: [
          {
            day: 1,
            title: "Arrival & Shibuya Exploration",
            activities: [
              "Land at Haneda Airport",
              "Check into hotel in Shibuya",
              "Visit Shibuya Crossing",
              "Explore Meiji Shrine",
              "Dinner at authentic ramen shop"
            ]
          },
          {
            day: 2,
            title: "Traditional Tokyo",
            activities: [
              "Early morning at Tsukiji Fish Market",
              "Senso-ji Temple in Asakusa",
              "Traditional lunch in Asakusa",
              "Tokyo National Museum",
              "Evening stroll in Ueno Park"
            ]
          }
        ],
        createdAt: new Date().toISOString()
      };
      setCurrentItinerary(mockItinerary);
      setIsProcessing(false);
      toast({
        title: "Video processed successfully!",
        description: "Your travel itinerary is ready",
      });
    }, 3000);
  };

  const saveItinerary = (itinerary) => {
    setSavedItineraries(prev => [itinerary, ...prev]);
    toast({
      title: "Itinerary saved!",
      description: "You can find it in your saved itineraries",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MapPin className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ClipToTrip
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform your TikTok travel videos into detailed itineraries with AI-powered transcription and planning
          </p>
        </div>

        <Tabs defaultValue="process" className="max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="process" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Process Video
            </TabsTrigger>
            <TabsTrigger value="current" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Current Trip
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex items-center gap-2">
              <Bookmark className="w-4 h-4" />
              Saved Trips
            </TabsTrigger>
          </TabsList>

          <TabsContent value="process" className="space-y-6">
            <Card className="p-6 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div>
                  <label htmlFor="tiktok-url" className="block text-sm font-medium text-gray-700 mb-2">
                    TikTok Video URL
                  </label>
                  <Input
                    id="tiktok-url"
                    type="url"
                    placeholder="https://www.tiktok.com/@username/video/..."
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    className="text-lg py-3"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 text-lg font-semibold transition-all duration-300 transform hover:scale-105"
                >
                  {isProcessing ? "Processing Video..." : "Generate Itinerary"}
                </Button>
              </form>
            </Card>

            {isProcessing && <VideoProcessor />}
          </TabsContent>

          <TabsContent value="current">
            {currentItinerary ? (
              <ItineraryDisplay
                itinerary={currentItinerary}
                onSave={() => saveItinerary(currentItinerary)}
              />
            ) : (
              <Card className="p-8 text-center shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No active itinerary</h3>
                <p className="text-gray-500">Process a TikTok video to see your generated itinerary here</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="saved">
            <SavedItineraries
              itineraries={savedItineraries}
              onSelect={setCurrentItinerary}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
