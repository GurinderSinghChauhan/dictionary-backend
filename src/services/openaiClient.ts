import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

export const getOpenAIClient = () => {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for generation features");
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
};
