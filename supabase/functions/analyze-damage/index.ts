import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Step 1: Analyzing vehicle damage with AI...');

    const systemPrompt = `You are an expert AI vehicle damage detection system. Your job is to carefully analyze vehicle images.

CRITICAL RULES:
1. If the image does NOT contain a vehicle (car, truck, motorcycle, etc.), set hasVehicle to false
2. If the vehicle is in PERFECT condition with NO visible damage, set hasDamage to false and damages to empty array
3. Only report damage that is ACTUALLY VISIBLE in the image - do not assume or guess damage
4. Be very accurate - false positives are worse than false negatives

When analyzing an image:
1. First determine if there is a vehicle in the image
2. If there is a vehicle, carefully examine for ACTUAL visible damage (dents, scratches, cracks, broken parts, rust, paint damage)
3. Only report damage you can clearly see - not potential or possible damage
4. If the car looks clean and undamaged, report no damage

Respond ONLY with a valid JSON object in this exact format:
{
  "hasVehicle": boolean,
  "hasDamage": boolean,
  "overallSeverity": "None" | "Minor" | "Moderate" | "Severe",
  "confidenceScore": number (0-100),
  "damages": [
    {
      "type": "string (dent/scratch/crack/broken/missing/rust/paint_damage)",
      "location": "string (specific part like front bumper, left door, hood, etc.)",
      "severity": "Minor" | "Moderate" | "Severe",
      "description": "string"
    }
  ],
  "affectedAreas": ["string"],
  "estimatedRepairCost": {
    "min": number,
    "max": number,
    "currency": "INR"
  },
  "recommendations": ["string"],
  "summary": "string (2-3 sentence summary)"
}

If no vehicle is detected, respond with:
{
  "hasVehicle": false,
  "hasDamage": false,
  "overallSeverity": "None",
  "confidenceScore": 95,
  "damages": [],
  "affectedAreas": [],
  "estimatedRepairCost": { "min": 0, "max": 0, "currency": "INR" },
  "recommendations": ["Please upload a clear image of a vehicle for damage analysis."],
  "summary": "No vehicle detected in the image. Please upload a clear photo of a car, truck, or motorcycle."
}

If vehicle is detected but has NO damage:
{
  "hasVehicle": true,
  "hasDamage": false,
  "overallSeverity": "None",
  "confidenceScore": 90,
  "damages": [],
  "affectedAreas": [],
  "estimatedRepairCost": { "min": 0, "max": 0, "currency": "INR" },
  "recommendations": ["Vehicle appears to be in good condition.", "Regular maintenance recommended."],
  "summary": "Vehicle analyzed. No visible damage detected. The vehicle appears to be in good condition."
}

IMPORTANT: Always estimate repair costs in Indian Rupees (INR). Typical ranges:
- Minor damage: ₹5,000 - ₹25,000
- Moderate damage: ₹25,000 - ₹1,00,000
- Severe damage: ₹1,00,000 - ₹5,00,000+`;

    // Step 1: Analyze the image for damage
    const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              {
                type: 'text',
                text: 'Analyze this image carefully. First check if it contains a vehicle. If yes, examine it for any visible damage. Be accurate and only report real damage you can see.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
      }),
    });

    if (!analysisResponse.ok) {
      if (analysisResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (analysisResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await analysisResponse.text();
      console.error('AI Gateway error:', analysisResponse.status, errorText);
      throw new Error(`AI Gateway error: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    const aiResponse = analysisData.choices?.[0]?.message?.content;
    
    console.log('Analysis Response received:', aiResponse);

    // Parse the JSON response from AI
    let analysisResult;
    try {
      let jsonStr = aiResponse;
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      analysisResult = {
        hasVehicle: false,
        hasDamage: false,
        overallSeverity: "None",
        confidenceScore: 0,
        damages: [],
        affectedAreas: [],
        estimatedRepairCost: { min: 0, max: 0, currency: "USD" },
        recommendations: ["Unable to analyze image. Please try with a clearer image."],
        summary: "Could not process the image. Please upload a clear image."
      };
    }

    // Step 2: If damage is detected, generate annotated image with damage markers
    let annotatedImage = null;
    
    if (analysisResult.hasVehicle && analysisResult.hasDamage && analysisResult.damages.length > 0) {
      console.log('Step 2: Generating annotated image with damage markers...');
      
      // Create a detailed prompt for the image editing model
      const damageDetails = analysisResult.damages.map((d: { type: string; location: string; severity: string }, i: number) => 
        `${i + 1}. ${d.severity.toUpperCase()} ${d.type} on the ${d.location}`
      ).join('\n');
      
      const annotationPrompt = `You are a professional vehicle damage annotator. Draw LARGE, BOLD, and CLEARLY VISIBLE markers on this vehicle image to highlight ALL damaged areas.

DAMAGE AREAS TO MARK (mark EACH one with a separate marker):
${damageDetails}

MARKING INSTRUCTIONS:
1. Draw a THICK BRIGHT RED circle or oval around EACH Severe damage area
2. Draw a THICK BRIGHT ORANGE circle or oval around EACH Moderate damage area  
3. Draw a THICK BRIGHT YELLOW circle or oval around EACH Minor damage area
4. Add a NUMBER (1, 2, 3, etc.) next to each circle corresponding to the damage list
5. Add a SHORT LABEL text near each marker (e.g., "HOOD DENT", "BUMPER CRACK")
6. Make sure circles are LARGE enough to clearly encompass the damaged area
7. Use THICK outlines (at least 5-10 pixels) so they are highly visible
8. Ensure ALL ${analysisResult.damages.length} damage areas are marked - do not miss any

The goal is to make EVERY damage area immediately obvious at a glance. Be thorough and mark all areas listed above.`;

      try {
        const imageEditResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: annotationPrompt
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageBase64
                    }
                  }
                ]
              }
            ],
            modalities: ['image', 'text']
          }),
        });

        if (imageEditResponse.ok) {
          const imageEditData = await imageEditResponse.json();
          console.log('Image edit response received');
          
          // Extract the annotated image
          const editedImageUrl = imageEditData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (editedImageUrl) {
            annotatedImage = editedImageUrl;
            console.log('Annotated image generated successfully');
          }
        } else {
          console.error('Image annotation failed:', await imageEditResponse.text());
        }
      } catch (imageError) {
        console.error('Error generating annotated image:', imageError);
        // Continue without annotated image
      }
    }

    return new Response(
      JSON.stringify({
        ...analysisResult,
        annotatedImage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in analyze-damage function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
