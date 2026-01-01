
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, FinalPrompt } from "../types";

export const analyzeVideo = async (videoBase64: string): Promise<AnalysisResult> => {
  // Always create a new instance right before use to get the latest key from the environment
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
          Identify visible pages and UI elements.
          Return JSON ONLY matching the schema.`
        }
      ]
    },
    config: {
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
    console.error("Gemini Parse Error:", e);
    throw new Error("Failed to parse AI response. Ensure the video is clear.");
  }
};

export const generateFinalPrompt = async (
  analysis: AnalysisResult, 
  userInstructions: string
): Promise<FinalPrompt> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Create a technical EDIT-ONLY prompt based on: ${JSON.stringify(analysis)} 
               User wants: ${userInstructions}`,
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
    return { content: data.content || "Prompt generation failed." };
  } catch (e) {
    throw new Error("Error generating final prompt.");
  }
};
