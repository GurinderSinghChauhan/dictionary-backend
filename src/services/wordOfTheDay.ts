import { getOpenAIClient } from "./openaiClient";

export async function getRandomWordFromOpenAI(): Promise<string> {
  const openai = getOpenAIClient();
  const prompt =
    "Give me a single rare English word (no meaning), one word only.";
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [{ role: "user", content: prompt }],
  });
  const word = response.choices[0].message.content || "";
  return word;
}
