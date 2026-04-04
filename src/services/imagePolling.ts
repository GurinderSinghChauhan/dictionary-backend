import { getPromptHistory } from "./generateImageWithComfyUI";

export const waitForImageFilename = async (
  promptId: string,
  retries = 150,
  delay = 4000
): Promise<string | null> => {
  for (let i = 0; i < retries; i += 1) {
    const history = await getPromptHistory(promptId);
    const outputNode = history?.[promptId]?.outputs?.["9"];

    if (outputNode?.images?.length > 0 && outputNode.images[0].filename) {
      return outputNode.images[0].filename;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return null;
};
