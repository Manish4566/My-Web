
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, FinalPrompt } from "../types";

export const analyzeVideo = async (videoBase64: string): Promise<AnalysisResult> => {
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
          text: `EXPERT UI AUDIT & AUDIO ANALYSIS:
          1. WATCH the video and LISTEN to the audio carefully.
          2. TRANSCRIBE the user's spoken words to identify the specific problems or edit requests they are describing.
          3. IDENTIFY visible UI components and their architecture.
          4. RETURN a JSON response with the following:
             - "pages": List of detected screens.
             - "elements": Details of UI components.
             - "reasoning": Your logical steps.
             - "spokenIntent": A summary of the EXACT instruction or problem the user MENTIONED in the audio. If no audio or no instruction, leave empty string.`
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
          reasoning: { type: Type.ARRAY, items: { type: Type.STRING } },
          spokenIntent: { type: Type.STRING, description: "The instructions extracted from the speaker's voice." }
        }
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return {
      pages: data.pages || [],
      elements: data.elements || [],
      reasoning: data.reasoning || [],
      spokenIntent: data.spokenIntent || ""
    };
  } catch (e) {
    console.error("Gemini Analysis Error:", e);
    throw new Error("Analysis failed. Ensure the video and audio are clear.");
  }
};

export const generateFinalPrompt = async (
  analysis: AnalysisResult, 
  userInstructions: string
): Promise<FinalPrompt> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Use combined context from audio (spokenIntent) and manual text
  const combinedInstructions = `Voice Feedback: ${analysis.spokenIntent || 'None'}. Additional Text: ${userInstructions || 'None'}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Act as a senior front-end architect. Create a technical EDIT-ONLY prompt.
               Architecture: ${JSON.stringify(analysis.elements)}
               Context: ${JSON.stringify(analysis.pages)}
               Goal: ${combinedInstructions}`,
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
