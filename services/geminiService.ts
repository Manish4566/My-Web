
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, FinalPrompt } from "../types";

const API_KEY = process.env.API_KEY || "";

export const analyzeVideo = async (videoBase64: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  // Using gemini-3-flash-preview for ultra-fast multimodal processing
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'video/mp4',
            data: videoBase64
          }
        },
        {
          text: `QUICK ANALYSIS: Scan this website video immediately. 
          Identify:
          1. Pages visible.
          2. Key UI elements (buttons, forms, sections).
          3. Structural logic.
          
          Return JSON ONLY:
          {
            "pages": ["string"],
            "elements": [{"type": "string", "description": "string", "canEdit": boolean}],
            "reasoning": ["string"]
          }`
        }
      ]
    },
    config: {
      // Removing thinkingBudget to prioritize raw speed and low latency
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pages: { type: Type.ARRAY, items: { type: Type.STRING } },
          elements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                description: { type: Type.STRING },
                canEdit: { type: Type.BOOLEAN }
              }
            }
          },
          reasoning: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return {
      pages: data.pages || [],
      elements: data.elements || [],
      reasoning: data.reasoning || []
    };
  } catch (e) {
    console.error("Error parsing Gemini response:", e);
    return { pages: [], elements: [], reasoning: [] };
  }
};

export const generateFinalPrompt = async (
  analysis: AnalysisResult, 
  userInstructions: string
): Promise<FinalPrompt> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `FAST GENERATION: Create a technical EDIT-ONLY prompt.
  
  ANALYSIS: ${JSON.stringify(analysis)}
  USER INSTRUCTIONS: ${userInstructions}

  RULES: No deletions, no full regeneration, preserve structure. Targeted edits only.
  
  Return JSON: {"content": "The final prompt text"}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING }
        },
        required: ["content"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return { content: data.content || "Failed to generate prompt content." };
  } catch (e) {
    return { content: "Error parsing generated prompt." };
  }
};
