
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, FinalPrompt } from "../types";

// Create a helper to get a fresh AI instance with the latest key
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeVideo = async (videoBase64: string): Promise<AnalysisResult> => {
  const ai = getAI();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'video/mp4',
                data: videoBase64
              }
            },
            {
              text: `EXPERT UI AUDIT & AUDIO ANALYSIS:
              1. WATCH the video and LISTEN to the audio carefully.
              2. TRANSCRIBE the user's spoken words to identify the specific problems or edit requests they are describing.
              3. IDENTIFY visible UI components and their architecture.
              4. RETURN a JSON response with the following:
                 - "pages": List of detected screens.
                 - "elements": Details of UI components.
                 - "reasoning": Your logical steps.
                 - "spokenIntent": A summary of the EXACT instruction or problem the user MENTIONED in the audio.`
            }
          ]
        }
      ],
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
            reasoning: { type: Type.ARRAY, items: { type: Type.STRING } },
            spokenIntent: { type: Type.STRING }
          },
          required: ["pages", "elements", "reasoning", "spokenIntent"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      pages: data.pages || [],
      elements: data.elements || [],
      reasoning: data.reasoning || [],
      spokenIntent: data.spokenIntent || ""
    };
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    if (error.message?.includes("Requested entity was not found")) {
      // This is a hint to the UI to re-trigger key selection
      throw new Error("API_KEY_INVALID");
    }
    throw new Error("Failed to analyze video. Please check your API key and connection.");
  }
};

export const generateFinalPrompt = async (
  analysis: AnalysisResult, 
  userInstructions: string
): Promise<FinalPrompt> => {
  const ai = getAI();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              text: `Act as a senior front-end architect. Create a technical EDIT-ONLY prompt for a developer tool.
                   Architecture: ${JSON.stringify(analysis.elements)}
                   Context: ${JSON.stringify(analysis.pages)}
                   Goal: Voice Feedback: ${analysis.spokenIntent}. Additional Text: ${userInstructions}
                   
                   Return a single "content" field with the full prompt text.`
            }
          ]
        }
      ],
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

    const data = JSON.parse(response.text || "{}");
    return { content: data.content || "Prompt generation failed." };
  } catch (error: any) {
    console.error("Gemini Prompt Gen Error:", error);
    throw new Error("Error generating final prompt.");
  }
};
