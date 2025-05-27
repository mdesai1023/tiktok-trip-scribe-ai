
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import VideoProcessor from "@/components/VideoProcessor";
import ItineraryDisplay from "@/components/ItineraryDisplay";
import SavedItineraries from "@/components/SavedItineraries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Video, Bookmark, LogIn } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [currentItinerary, setCurrentItinerary] = useState(null);
  const [savedItineraries, setSavedItineraries] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("process");
  const { toast } = useToast();
  const { user, loading } = useAuth();

  // Fetch saved itineraries when user is authenticated
  useEffect(() => {
    if (user) {
      fetchSavedItineraries();
    }
  }, [user]);

  const fetchSavedItineraries = async () => {
    try {
      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedItineraries(data || []);
    } catch (error: any) {
      console.error('Error fetching itineraries:', error);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to process TikTok videos",
        variant: "destructive",
      });
      return;
    }

    if (!tiktokUrl.trim()) {
      toast({
        title: "Please enter a TikTok URL",
        description: "We need a valid TikTok link to process",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setCurrentItinerary(null);

    try {
      const { data, error } = await supabase.functions.invoke('process-tiktok', {
        body: { videoUrl: tiktokUrl }
      });

      if (error) throw error;

      if (data.success) {
        setCurrentItinerary(data.itinerary);
        await fetchSavedItineraries(); // Refresh saved list
        setActiveTab("current"); // Switch to current trip tab
        toast({
          title: "Video processed successfully!",
          description: "Your travel itinerary is ready",
        });
      } else {
        throw new Error(data.error || 'Processing failed');
      }
    } catch (error: any) {
      console.error('Processing error:', error);
      toast({
        title: "Processing failed",
        description: error.message || "Failed to process the TikTok video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectItinerary = (itinerary: any) => {
    setCurrentItinerary(itinerary);
    setActiveTab("current"); // Switch to current trip tab
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MapPin className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ClipToTrip
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Transform your TikTok travel videos into detailed itineraries with AI-powered transcription and planning
          </p>
          
          <Card className="p-8 max-w-md mx-auto shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <LogIn className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Get Started</h3>
            <p className="text-gray-600 mb-6">
              Sign in to start processing TikTok videos and creating amazing travel itineraries
            </p>
            <Link to="/auth">
              <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 text-lg font-semibold">
                Sign In / Sign Up
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-4xl mx-auto">
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
            Saved Trips ({savedItineraries.length})
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
              onSave={() => {
                toast({
                  title: "Already saved!",
                  description: "This itinerary is automatically saved to your account",
                });
              }}
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
            onSelect={handleSelectItinerary}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
