
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, FinalPrompt } from "../types";

// Initialize the AI client directly in the frontend
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeVideo = async (videoBase64: string): Promise<AnalysisResult> => {
  const ai = getAI();
  
  try {
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
            text: `EXPERT UI AUDIT & AUDIO ANALYSIS:
            1. WATCH the video and LISTEN to the audio carefully.
            2. TRANSCRIBE the user's spoken words to identify the specific problems or edit requests they are describing.
            3. IDENTIFY visible UI components and their architecture.
            4. RETURN a JSON response strictly following the provided schema.
            
            Focus specifically on:
            - The exact words spoken (spokenIntent).
            - The functional components visible (elements).
            - The flow between screens (pages).`
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
                },
                required: ["type", "description", "canEdit"]
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
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Video analysis failed. Ensure the file is under 20MB and the API key is valid.");
  }
};

export const generateFinalPrompt = async (
  analysis: AnalysisResult, 
  userInstructions: string
): Promise<FinalPrompt> => {
  const ai = getAI();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Act as a senior front-end architect. Create a technical EDIT-ONLY prompt based on the following audit.
                 Architecture: ${JSON.stringify(analysis.elements)}
                 Context: ${JSON.stringify(analysis.pages)}
                 Voice Feedback from Recording: ${analysis.spokenIntent}
                 Additional User Instructions: ${userInstructions}
                 
                 The output prompt should be ready to be pasted into a coding assistant to perform the requested edits without breaking existing functionality.`,
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
  } catch (error) {
    console.error("Gemini Prompt Generation Error:", error);
    throw new Error("Failed to generate final prompt.");
  }
};
