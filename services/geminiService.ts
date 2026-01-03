
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, FinalPrompt } from "../types";

// Create a helper to get a fresh AI instance with the latest key
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeVideo = async (videoBase64: string): Promise<AnalysisResult> => {
  try {
    const ai = getAI();
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
              1. WATCH the video and LISTEN to the audio track carefully.
              2. IF SPEECH IS DETECTED: Transcribe the user's spoken words to identify the specific problems or edit requests.
              3. IF NO SPEECH IS DETECTED or the video is silent: Leave the "spokenIntent" field as an empty string (""). DO NOT make up or assume instructions if audio is missing.
              4. IDENTIFY visible UI components, layouts, and their architecture.
              5. RETURN a JSON response with the following:
                 - "pages": List of detected screens.
                 - "elements": Details of UI components (buttons, inputs, cards).
                 - "reasoning": Your logical steps for this audit.
                 - "spokenIntent": The EXACT instruction from the audio, or an empty string if silent.`
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
    if (error.message === "API_KEY_MISSING" || error.message?.includes("Requested entity was not found")) {
      throw new Error("API_KEY_INVALID");
    }
    throw new Error("Failed to analyze video. Please check your API key and connection.");
  }
};

export const generateFinalPrompt = async (
  analysis: AnalysisResult, 
  userInstructions: string
): Promise<FinalPrompt> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              text: `Act as a senior front-end architect. Create a technical EDIT-ONLY prompt for a developer tool based on visual analysis and instructions.
                   Architecture Context: ${JSON.stringify(analysis.elements)}
                   Screens Detected: ${JSON.stringify(analysis.pages)}
                   Input Source 1 (Transcribed Voice): ${analysis.spokenIntent || "No voice audio detected"}
                   Input Source 2 (User Text Box): ${userInstructions || "No additional text provided"}
                   
                   TASK: Combine the visual architecture audit with the user's goals to create a highly specific, code-centric prompt.
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
