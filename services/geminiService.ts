
import { AnalysisResult, FinalPrompt } from "../types";

const FUNCTION_URL = "/.netlify/functions/api";

export const analyzeVideo = async (videoBase64: string): Promise<AnalysisResult> => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "analyze",
      payload: { videoBase64 }
    }),
  });

  if (!response.ok) {
    throw new Error("Analysis request failed");
  }

  const rawText = await response.json();
  try {
    const data = JSON.parse(rawText);
    return {
      pages: data.pages || [],
      elements: data.elements || [],
      reasoning: data.reasoning || [],
      spokenIntent: data.spokenIntent || ""
    };
  } catch (e) {
    console.error("Gemini Parse Error:", e);
    throw new Error("Failed to parse analysis result.");
  }
};

export const generateFinalPrompt = async (
  analysis: AnalysisResult, 
  userInstructions: string
): Promise<FinalPrompt> => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "generatePrompt",
      payload: { analysis, userInstructions }
    }),
  });

  if (!response.ok) {
    throw new Error("Prompt generation failed");
  }

  const rawText = await response.json();
  try {
    const data = JSON.parse(rawText);
    return { content: data.content || "Prompt generation failed." };
  } catch (e) {
    throw new Error("Error generating final prompt.");
  }
};
