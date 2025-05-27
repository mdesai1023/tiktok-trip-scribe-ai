import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import fs from 'fs';
import os from 'os';
import path from 'path';
import fetch from 'node-fetch';
import { execSync } from 'child_process';
import FormData from 'form-data';

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
  console.log('Downloading TikTok video:', videoUrl);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-'));
  const videoPath = path.join(tempDir, 'video.mp4');
  const audioPath = path.join(tempDir, 'audio.mp3');

  // 1. Download TikTok video
  const downloaderApi = `https://api.tikmate.app/api/lookup?url=${encodeURIComponent(videoUrl)}`;
  const lookupRes = await fetch(downloaderApi);
  if (!lookupRes.ok) throw new Error('Failed to lookup TikTok video');
  const lookupData = await lookupRes.json();
  if (!lookupData.token || !lookupData.id) throw new Error('Invalid TikTok lookup response');
  const downloadUrl = `https://tikmate.app/download/${lookupData.token}/${lookupData.id}.mp4`;
  const videoRes = await fetch(downloadUrl);
  if (!videoRes.ok) throw new Error('Failed to download TikTok video');
  const videoBuffer = await videoRes.buffer();
  fs.writeFileSync(videoPath, videoBuffer);

  // 2. Extract audio using ffmpeg
  execSync(`ffmpeg -y -i "${videoPath}" -vn -acodec mp3 "${audioPath}"`);

  // 3. Transcribe audio with OpenAI Whisper
  const audioFile = fs.readFileSync(audioPath);
  const form = new FormData();
  form.append('file', audioFile, { filename: 'audio.mp3', contentType: 'audio/mp3' });
  form.append('model', 'whisper-1');
  // Optionally, you can set 'response_format' to 'verbose_json' to get word-level timestamps
  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiApiKey}` },
    body: form
  });
  if (!whisperRes.ok) {
    const errText = await whisperRes.text();
    throw new Error(`Whisper API error: ${errText}`);
  }
  const whisperData = await whisperRes.json();
  const transcript = whisperData.text || '';

  // 4. Extract on-screen text and caption using GPT
  // (You could also use OCR for on-screen text, but here we use GPT to infer it from the transcript)
  const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
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
          content: `You are a travel content analyzer. Given the following TikTok audio transcript, extract:
- The main travel destination(s)
- Key activities and locations mentioned
- Any on-screen text or tips that would likely appear
- The TikTok caption (summarize what a typical creator would write as a caption for this video)
Return your answer in this JSON format:
{
  "location": "...",
  "activities": ["...", "..."],
  "screenText": "...",
  "caption": "..."
}
`
        },
        {
          role: 'user',
          content: `TikTok Transcript: ${transcript}`
        }
      ],
      temperature: 0.5,
    }),
  });
  if (!gptRes.ok) {
    const errText = await gptRes.text();
    throw new Error(`OpenAI GPT error: ${errText}`);
  }
  const gptData = await gptRes.json();
  let location = 'Unknown';
  let activities: string[] = [];
  let screenText = '';
  let caption = '';
  try {
    const json = JSON.parse(gptData.choices?.[0]?.message?.content || '{}');
    location = json.location || location;
    activities = json.activities || [];
    screenText = json.screenText || '';
    caption = json.caption || '';
  } catch (e) {
    // fallback: just use the transcript as a generic fallback
    screenText = transcript;
    caption = transcript;
  }

  // Clean up temp files
  fs.unlinkSync(videoPath);
  fs.unlinkSync(audioPath);
  fs.rmdirSync(tempDir);

  return {
    transcription: transcript,
    caption,
    screenText,
    location,
    activities
  };
}

async function generateItinerary(videoAnalysis: any, openaiApiKey: string) {
  console.log('Generating detailed itinerary for:', videoAnalysis.location);

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
Caption: ${videoAnalysis.caption}
Activities: ${videoAnalysis.activities?.join(', ')}

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
  const durationMatch = itineraryText.match(/(\\d+)\\s*days?/i);
  const duration = durationMatch ? `${durationMatch[1]} Days` : '5 Days';

  // Parse the itinerary into structured format
  const days: { day: number; title: string; activities: string[] }[] = [];
  const dayMatches = itineraryText.match(/day\\s*\\d+[:\\-\\s]*([^\\n]+)/gi);

  if (dayMatches) {
    dayMatches.forEach((dayMatch, index) => {
      const dayTitle = dayMatch.replace(/day\\s*\\d+[:\\-\\s]*/i, '').trim();
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
}
