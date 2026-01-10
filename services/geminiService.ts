
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, FinalPrompt } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeMedia = async (
  base64Data: string, 
  mimeType: string
): Promise<AnalysisResult> => {
  try {
    const ai = getAI();
    // Use gemini-3-pro-preview for high-quality multimodal analysis as requested
    const model = 'gemini-3-pro-preview';
    
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            {
              text: `EXPERT UI ARCHITECT AUDIT:
              1. ANALYZE the provided ${mimeType.split('/')[0]} (UI screenshot, screen recording, or document).
              2. IDENTIFY visible screens/pages, UI components, and layout architecture.
              3. IF AUDIO/TEXT IS PRESENT: Identify intent.
              4. RETURN a JSON response:
                 - "pages": List of detected screens.
                 - "elements": Details of UI components (type, description, canEdit: boolean).
                 - "reasoning": Logical steps for this audit.
                 - "spokenIntent": Summary of requested changes or identified problems.`
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
    console.error("Gemini Media Analysis Error:", error);
    if (error.message === "API_KEY_MISSING" || error.message?.includes("Requested entity was not found")) {
      throw new Error("API_KEY_INVALID");
    }
    throw new Error("Failed to analyze media. Please check your API key.");
  }
};

export const generateFinalPrompt = async (
  analysis: AnalysisResult, 
  userInstructions: string
): Promise<FinalPrompt> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          parts: [
            {
              text: `Act as a senior front-end architect. Create a technical EDIT-ONLY prompt for a developer tool based on visual analysis and instructions.
                   Architecture Context: ${JSON.stringify(analysis.elements)}
                   Screens Detected: ${JSON.stringify(analysis.pages)}
                   Input Source 1 (Automated Intent): ${analysis.spokenIntent || "No specific voice/text intent found"}
                   Input Source 2 (User Text Box): ${userInstructions || "No additional text provided"}
                   
                   TASK: Combine the visual architecture audit with the user's goals to create a highly specific, code-centric prompt for modifying a web application.
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
    if (error.message === "API_KEY_MISSING") throw new Error("API_KEY_INVALID");
    throw new Error("Error generating final prompt.");
  }
};
