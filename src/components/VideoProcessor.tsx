
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Video, Brain, FileText, MapPin } from "lucide-react";

const VideoProcessor = () => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { icon: Video, label: "Downloading video", color: "text-blue-600" },
    { icon: FileText, label: "Transcribing audio", color: "text-green-600" },
    { icon: Brain, label: "Analyzing content", color: "text-purple-600" },
    { icon: MapPin, label: "Generating itinerary", color: "text-orange-600" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + 2;
        const stepIndex = Math.floor(newProgress / 25);
        setCurrentStep(Math.min(stepIndex, steps.length - 1));
        return Math.min(newProgress, 100);
      });
    }, 60);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="p-6 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Processing Your Video</h3>
          <p className="text-gray-600">AI is analyzing your TikTok content to create the perfect itinerary</p>
        </div>

        <div className="space-y-4">
          <Progress value={progress} className="h-3" />
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div
                  key={index}
                  className={`flex flex-col items-center p-4 rounded-lg transition-all duration-300 ${
                    isActive
                      ? "bg-blue-50 scale-105"
                      : isCompleted
                      ? "bg-green-50"
                      : "bg-gray-50"
                  }`}
                >
                  <Icon
                    className={`w-8 h-8 mb-2 transition-colors duration-300 ${
                      isActive
                        ? step.color
                        : isCompleted
                        ? "text-green-600"
                        : "text-gray-400"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium text-center ${
                      isActive || isCompleted ? "text-gray-800" : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-blue-800">
              {steps[currentStep]?.label || "Processing..."}
            </span>
          </div>
          <p className="text-xs text-blue-600">
            This usually takes 30-60 seconds depending on video length
          </p>
        </div>
      </div>
    </Card>
  );
};

export default VideoProcessor;
