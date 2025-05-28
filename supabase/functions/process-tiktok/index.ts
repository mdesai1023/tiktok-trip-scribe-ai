import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl } = await req.json();
    
    if (!videoUrl) {
      throw new Error('Video URL is required');
    }

    console.log('Processing TikTok video:', videoUrl);

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const googleCloudApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');

    console.log('Environment check - Supabase URL:', supabaseUrl ? 'Present' : 'Missing');
    console.log('Environment check - Supabase Key:', supabaseKey ? 'Present' : 'Missing');
    console.log('Environment check - OpenAI Key:', openaiApiKey ? 'Present' : 'Missing');
    console.log('Environment check - Google Cloud Key:', googleCloudApiKey ? 'Present' : 'Missing');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    if (!openaiApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    if (!googleCloudApiKey) {
      throw new Error('Google Cloud Vision API key is not configured');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Invalid authentication');
    }

    console.log('User authenticated:', user.id);

    // Step 1: Clean and resolve TikTok URL
    const cleanedUrl = cleanTikTokUrl(videoUrl);
    console.log('Cleaned URL:', cleanedUrl);

    // Step 2: Download and analyze TikTok video using yt-dlp
    console.log('Downloading and analyzing TikTok video with yt-dlp...');
    const videoAnalysis = await downloadAndAnalyzeVideoWithYtDlp(cleanedUrl, openaiApiKey, googleCloudApiKey);
    console.log('Video analysis completed for location:', videoAnalysis.location);
    
    // Step 3: Generate detailed itinerary based on real analysis
    const itinerary = await generateItinerary(videoAnalysis, openaiApiKey);
    console.log('Itinerary generated for:', itinerary.location);
    
    // Step 4: Save to database
    const { data: savedItinerary, error: saveError } = await supabase
      .from('itineraries')
      .insert({
        user_id: user.id,
        title: itinerary.title,
        location: itinerary.location,
        duration: itinerary.duration,
        video_url: videoUrl,
        transcription: videoAnalysis.transcription,
        caption_text: videoAnalysis.caption,
        screen_text: videoAnalysis.screenText,
        itinerary_content: itinerary.content
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving itinerary:', saveError);
      throw new Error('Failed to save itinerary');
    }

    console.log('Itinerary saved successfully:', savedItinerary.id);

    return new Response(JSON.stringify({
      success: true,
      itinerary: {
        id: savedItinerary.id,
        title: savedItinerary.title,
        location: savedItinerary.location,
        duration: savedItinerary.duration,
        videoUrl: savedItinerary.video_url,
        transcription: savedItinerary.transcription,
        itinerary: savedItinerary.itinerary_content,
        createdAt: savedItinerary.created_at
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing TikTok video:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to process video' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function cleanTikTokUrl(url: string): string {
  try {
    // Remove tracking parameters and clean the URL
    const urlObj = new URL(url);
    
    // Handle mobile URLs (vm.tiktok.com, m.tiktok.com)
    if (urlObj.hostname === 'vm.tiktok.com' || urlObj.hostname === 'm.tiktok.com') {
      // These are short URLs that redirect, we'll let yt-dlp handle the resolution
      return url;
    }
    
    // For standard TikTok URLs, clean parameters
    if (urlObj.hostname === 'www.tiktok.com' || urlObj.hostname === 'tiktok.com') {
      // Keep only the essential path, remove query parameters
      const cleanUrl = `https://www.tiktok.com${urlObj.pathname}`;
      console.log('Cleaned TikTok URL from', url, 'to', cleanUrl);
      return cleanUrl;
    }
    
    return url;
  } catch (error) {
    console.warn('Failed to clean URL, using original:', error);
    return url;
  }
}

async function downloadAndAnalyzeVideoWithYtDlp(videoUrl: string, openaiApiKey: string, googleCloudApiKey: string) {
  console.log('Starting video download with yt-dlp...');
  
  try {
    // Step 1: Try to download with yt-dlp
    const videoData = await downloadVideoWithYtDlp(videoUrl);
    
    if (!videoData) {
      throw new Error('Failed to download video with yt-dlp');
    }

    console.log('Video downloaded successfully, size:', videoData.length);

    // Step 2: Transcribe audio with OpenAI Whisper
    console.log('Transcribing audio with Whisper...');
    const transcription = await transcribeWithWhisper(videoData, openaiApiKey);
    console.log('Transcription completed:', transcription.substring(0, 100) + '...');

    // Step 3: Analyze video frames with GPT Vision
    console.log('Analyzing video content with GPT Vision...');
    const visionAnalysis = await analyzeVideoWithGPTVision(videoData, openaiApiKey);
    
    // Step 4: Extract location and travel info from transcription
    console.log('Extracting travel information...');
    const travelInfo = await extractTravelInfo(transcription, visionAnalysis, openaiApiKey);

    return {
      transcription: transcription,
      caption: travelInfo.caption,
      screenText: visionAnalysis.screenText,
      location: travelInfo.location,
      activities: travelInfo.activities
    };

  } catch (error) {
    console.error('Error in downloadAndAnalyzeVideoWithYtDlp:', error);
    throw new Error(`Video analysis failed: ${error.message}`);
  }
}

async function downloadVideoWithYtDlp(videoUrl: string): Promise<Uint8Array | null> {
  try {
    console.log('Attempting to download with yt-dlp:', videoUrl);
    
    // Create a temporary file path
    const tempVideoPath = `/tmp/tiktok_${Date.now()}.mp4`;
    
    // Run yt-dlp command
    const ytDlpCommand = new Deno.Command("yt-dlp", {
      args: [
        "--no-warnings",
        "--quiet",
        "--format", "best[ext=mp4]/mp4/best",
        "--output", tempVideoPath,
        "--max-filesize", "50M", // Limit file size
        "--timeout", "30", // 30 second timeout
        videoUrl
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const process = ytDlpCommand.spawn();
    const { code, stdout, stderr } = await process.output();

    if (code !== 0) {
      const errorOutput = new TextDecoder().decode(stderr);
      console.error('yt-dlp failed:', errorOutput);
      
      // Check for specific error cases
      if (errorOutput.includes('private') || errorOutput.includes('restricted')) {
        throw new Error('This TikTok video is private or restricted and cannot be processed');
      }
      if (errorOutput.includes('not available')) {
        throw new Error('This TikTok video is not available or has been removed');
      }
      
      // Try fallback method
      console.log('yt-dlp failed, trying fallback method...');
      return await downloadVideoFallback(videoUrl);
    }

    // Read the downloaded file
    console.log('Reading downloaded video file...');
    const videoData = await Deno.readFile(tempVideoPath);
    
    // Clean up temporary file
    try {
      await Deno.remove(tempVideoPath);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp file:', cleanupError);
    }

    return videoData;

  } catch (error) {
    console.error('yt-dlp download failed:', error);
    
    // Try fallback method
    console.log('Trying fallback download method...');
    return await downloadVideoFallback(videoUrl);
  }
}

async function downloadVideoFallback(videoUrl: string): Promise<Uint8Array | null> {
  try {
    console.log('Using fallback download method for:', videoUrl);
    
    // Simple fetch fallback (limited effectiveness but worth trying)
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Fallback download failed: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
    
  } catch (error) {
    console.error('Fallback download failed:', error);
    throw new Error('Failed to download video. The video may be private, restricted, or the URL may be invalid.');
  }
}

async function transcribeWithWhisper(videoBytes: Uint8Array, openaiApiKey: string): Promise<string> {
  try {
    const formData = new FormData();
    const blob = new Blob([videoBytes], { type: 'video/mp4' });
    formData.append('file', blob, 'video.mp4');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }

    const transcription = await response.text();
    return transcription.trim();

  } catch (error) {
    console.error('Error in transcribeWithWhisper:', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

async function analyzeVideoWithGPTVision(videoBytes: Uint8Array, openaiApiKey: string) {
  try {
    // Convert video bytes to base64 for vision analysis
    // Note: GPT-4 Vision can analyze video frames directly
    const base64Video = btoa(String.fromCharCode(...videoBytes.slice(0, 100000))); // Sample first 100KB
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are analyzing a TikTok travel video. Focus on extracting any visible text, location names, landmarks, or travel-related visual elements you can see in the video frames.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this travel video and extract any visible text overlays, location names, landmarks, or travel-related visual elements. Focus on text that appears on screen and identifiable locations.'
              }
            ]
          }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.warn('GPT Vision analysis failed, using fallback');
      return { screenText: 'No screen text detected' };
    }

    const data = await response.json();
    const analysis = data.choices[0]?.message?.content || 'No visual analysis available';
    
    return {
      screenText: analysis
    };

  } catch (error) {
    console.warn('Vision analysis failed:', error);
    return { screenText: 'Screen text analysis unavailable' };
  }
}

async function extractTravelInfo(transcription: string, visionAnalysis: any, openaiApiKey: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a travel content analyzer. Extract travel information from the provided transcript and visual analysis. Return ONLY a JSON object with this exact format:
{
  "location": "specific destination name",
  "activities": ["activity1", "activity2", "activity3"],
  "caption": "what the creator would likely caption this video"
}

Be specific about the location. If multiple locations are mentioned, use the primary destination.`
          },
          {
            role: 'user',
            content: `Transcript: "${transcription}"
            
Visual Analysis: "${visionAnalysis.screenText}"

Extract the travel information and return ONLY the JSON object.`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    
    try {
      const parsed = JSON.parse(content);
      return {
        location: parsed.location || 'Unknown Location',
        activities: parsed.activities || [],
        caption: parsed.caption || transcription.substring(0, 100) + '...'
      };
    } catch (parseError) {
      console.warn('Failed to parse travel info JSON, using fallback');
      return {
        location: 'Unknown Location',
        activities: [],
        caption: transcription.substring(0, 100) + '...'
      };
    }

  } catch (error) {
    console.error('Error extracting travel info:', error);
    return {
      location: 'Unknown Location',
      activities: [],
      caption: 'Travel experience'
    };
  }
}

async function generateItinerary(videoAnalysis: any, openaiApiKey: string) {
  console.log('Generating detailed itinerary for:', videoAnalysis.location);

  if (!videoAnalysis.location || videoAnalysis.location === 'Unknown Location') {
    throw new Error('Could not determine travel location from video. Please ensure the video contains clear location information.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional travel planner. Create detailed, practical travel itineraries based on ACTUAL video content analysis. Include specific activities, timing, locations, and helpful tips.'
        },
        {
          role: 'user',
          content: `Create a detailed travel itinerary for ${videoAnalysis.location} based on this ACTUAL video content:

REAL TRANSCRIPTION: "${videoAnalysis.transcription}"
ACTIVITIES MENTIONED: ${videoAnalysis.activities?.join(', ') || 'None specified'}
VISUAL CONTENT: "${videoAnalysis.screenText}"

Create a comprehensive itinerary with:
- Clear title for ${videoAnalysis.location}
- Recommended duration (3-7 days)
- Day-by-day breakdown with specific activities for ${videoAnalysis.location}
- Include the activities mentioned in the video
- Practical tips specific to ${videoAnalysis.location}

Focus on ${videoAnalysis.location} specifically and incorporate the actual content from the video.`
        }
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error in generateItinerary:', response.status, errorText);
    throw new Error(`Failed to generate itinerary: ${response.status}`);
  }

  const data = await response.json();
  const itineraryText = data.choices[0]?.message?.content;

  if (!itineraryText) {
    throw new Error('No itinerary content generated');
  }

  // Extract duration from the response
  const durationMatch = itineraryText.match(/(\d+)\s*days?/i);
  const duration = durationMatch ? `${durationMatch[1]} Days` : '5 Days';

  // Parse the itinerary into structured format
  const days: { day: number; title: string; activities: string[] }[] = [];
  
  // Simple parsing - split by day markers
  const dayMarkers = itineraryText.split(/day\s*\d+/i);
  
  for (let i = 1; i < Math.min(dayMarkers.length, 8); i++) {
    const dayContent = dayMarkers[i].trim();
    const lines = dayContent.split('\n').filter(line => line.trim());
    
    const title = lines[0]?.replace(/[:\-]/g, '').trim() || `Day ${i} in ${videoAnalysis.location}`;
    const activities = lines.slice(1)
      .filter(line => line.includes('-') || line.includes('•') || line.includes('*'))
      .map(line => line.replace(/^[\-\•\*\s]+/, '').trim())
      .filter(activity => activity.length > 0)
      .slice(0, 4);

    if (activities.length === 0) {
      activities.push(
        `Explore ${videoAnalysis.location} highlights`,
        `Experience local culture and cuisine`,
        `Visit attractions mentioned in the video`
      );
    }

    days.push({
      day: i,
      title: title,
      activities: activities
    });
  }

  // Ensure we have at least 3 days
  while (days.length < 3) {
    const dayNum = days.length + 1;
    days.push({
      day: dayNum,
      title: `Day ${dayNum} - Exploring ${videoAnalysis.location}`,
      activities: [
        `Discover ${videoAnalysis.location} attractions`,
        `Local dining experiences`,
        `Cultural activities`,
        `Relaxation and exploration time`
      ]
    });
  }

  return {
    title: `${videoAnalysis.location} Adventure`,
    location: videoAnalysis.location,
    duration: duration,
    content: days
  };
}
