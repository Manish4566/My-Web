
import { GoogleGenAI, Type } from "@google/genai";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { action, payload } = JSON.parse(event.body);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    if (action === "analyze") {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'video/mp4',
                data: payload.videoBase64
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
              spokenIntent: { type: Type.STRING }
            }
          }
        }
      });
      return { statusCode: 200, body: JSON.stringify(response.text) };
    }

    if (action === "generatePrompt") {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Act as a senior front-end architect. Create a technical EDIT-ONLY prompt.
                   Architecture: ${JSON.stringify(payload.analysis.elements)}
                   Context: ${JSON.stringify(payload.analysis.pages)}
                   Goal: Voice Feedback: ${payload.analysis.spokenIntent}. Additional Text: ${payload.userInstructions}`,
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
      return { statusCode: 200, body: JSON.stringify(response.text) };
    }

    return { statusCode: 400, body: "Invalid Action" };
  } catch (error) {
    console.error("API Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
