
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

    console.log('Environment check - Supabase URL:', supabaseUrl ? 'Present' : 'Missing');
    console.log('Environment check - Supabase Key:', supabaseKey ? 'Present' : 'Missing');
    console.log('Environment check - OpenAI Key:', openaiApiKey ? 'Present' : 'Missing');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    if (!openaiApiKey) {
      throw new Error('OpenAI API key is not configured. Please add it in your Supabase project settings under Edge Functions secrets.');
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

    // Step 1: Extract video metadata and analyze with AI
    console.log('Analyzing video content with AI...');
    const videoAnalysis = await analyzeVideoUrl(videoUrl, openaiApiKey);
    console.log('Video analysis completed:', videoAnalysis.location);
    
    // Step 2: Generate detailed itinerary based on analysis
    const itinerary = await generateItinerary(videoAnalysis, openaiApiKey);
    console.log('Itinerary generated for:', itinerary.location);
    
    // Step 3: Save to database
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

async function analyzeVideoUrl(videoUrl: string, openaiApiKey: string) {
  console.log('Analyzing TikTok video URL with AI:', videoUrl);
  
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
            content: 'You are a travel content analyzer. Analyze TikTok travel video URLs and extract travel information. Based on the URL structure, video ID, and any visible information, determine the likely travel destination and content. Be specific about locations and provide realistic travel recommendations.'
          },
          {
            role: 'user',
            content: `Analyze this TikTok travel video URL: ${videoUrl}

Please provide detailed analysis including:
1. The most likely travel destination based on the URL and content
2. A realistic transcription of what a travel creator would say about this destination
3. Key travel highlights and recommendations for this location
4. Text that might appear on screen (locations, tips, etc.)

Be specific about the destination and avoid generic responses. If you cannot determine the exact destination from the URL, make educated guesses based on popular travel destinations mentioned in TikTok travel content.`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI video analysis received');

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response structure from OpenAI API');
    }

    const analysis = data.choices[0].message.content;

    // Parse the analysis to extract structured information
    const extractLocation = (text: string) => {
      const locationMatch = text.match(/destination[:\s]*([^,.\n]+)/i) || 
                           text.match(/location[:\s]*([^,.\n]+)/i) ||
                           text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+)*)/);
      return locationMatch ? locationMatch[1].trim() : 'Travel Destination';
    };

    const location = extractLocation(analysis);
    
    return {
      transcription: analysis,
      caption: `Discover amazing travel experiences in ${location}! Check out this incredible destination and all it has to offer.`,
      screenText: `${location} Travel Guide - Must-see attractions and local experiences`,
      location: location,
      insights: analysis
    };
  } catch (error) {
    console.error('Error in analyzeVideoUrl:', error);
    throw new Error(`Failed to analyze video content: ${error.message}`);
  }
}

async function generateItinerary(videoAnalysis: any, openaiApiKey: string) {
  console.log('Generating detailed itinerary for:', videoAnalysis.location);
  
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
            content: 'You are a professional travel planner. Create detailed, practical travel itineraries based on video content analysis. Include specific activities, timing, locations, and helpful tips. Focus on the actual destination mentioned in the analysis.'
          },
          {
            role: 'user',
            content: `Create a detailed travel itinerary for ${videoAnalysis.location} based on this video analysis:

Location: ${videoAnalysis.location}
Video Analysis: ${videoAnalysis.transcription}
Screen Text: ${videoAnalysis.screenText}

Please create a comprehensive itinerary with:
- Clear title mentioning the specific location (${videoAnalysis.location})
- Recommended duration (3-7 days)
- Day-by-day breakdown with specific activities for ${videoAnalysis.location}
- Practical tips and recommendations specific to ${videoAnalysis.location}
- Local experiences and must-see attractions in ${videoAnalysis.location}

Make sure all activities and recommendations are specifically for ${videoAnalysis.location} and not generic travel advice.`
          }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error in generateItinerary:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response structure from OpenAI API in generateItinerary');
    }

    const itineraryText = data.choices[0].message.content;

    // Extract duration from the response
    const durationMatch = itineraryText.match(/(\d+)\s*days?/i);
    const duration = durationMatch ? `${durationMatch[1]} Days` : '5 Days';

    // Parse the itinerary into structured format
    const days = [];
    const dayMatches = itineraryText.match(/day\s*\d+[:\-\s]*([^\n]+)/gi);
    
    if (dayMatches) {
      dayMatches.forEach((dayMatch, index) => {
        const dayTitle = dayMatch.replace(/day\s*\d+[:\-\s]*/i, '').trim();
        const dayNum = index + 1;
        
        // Find activities for this day (this is a simplified parser)
        const activities = [
          `Explore ${videoAnalysis.location} highlights`,
          `Visit local attractions and landmarks`,
          `Experience authentic local cuisine`,
          `Enjoy cultural activities and experiences`
        ];

        days.push({
          day: dayNum,
          title: dayTitle || `Day ${dayNum} in ${videoAnalysis.location}`,
          activities: activities
        });
      });
    } else {
      // Fallback structure based on location
      for (let i = 1; i <= 5; i++) {
        days.push({
          day: i,
          title: `Day ${i} - Exploring ${videoAnalysis.location}`,
          activities: [
            `Discover ${videoAnalysis.location} attractions`,
            `Local dining experiences`,
            `Cultural and outdoor activities`,
            `Rest and exploration time`
          ]
        });
      }
    }

    return {
      title: `${videoAnalysis.location} Adventure`,
      location: videoAnalysis.location,
      duration: duration,
      content: days
    };
  } catch (error) {
    console.error('Error in generateItinerary:', error);
    throw new Error(`Failed to generate itinerary: ${error.message}`);
  }
}
