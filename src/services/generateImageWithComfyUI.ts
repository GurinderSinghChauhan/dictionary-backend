import axios from "axios";
import PromptJSON from "../mock/prompt.json";
import AWS from "aws-sdk";
import dotenv from "dotenv";

const comfyURL = 'http://127.0.0.1:8188'

dotenv.config();

if (AWS.config.update) {
  AWS.config.update({
    region: "eu-north-1",
  });
}

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  AWS.config.credentials = new AWS.Credentials(
    process.env.AWS_ACCESS_KEY_ID,
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

const s3 = new AWS.S3();

export async function sendPromptAPI(positive: string,) {
  // PromptJSON
  PromptJSON.prompt["6"].inputs.text = `${positive} realistic, high quality, detailed, sharp focus, vibrant colors, cinematic lighting, professional photography, clear resolution, masterpiece, hyper-realistic, `;
  PromptJSON.prompt["7"].inputs.text = 'blurry, cartoon, painting, illustration, low resolution, deformed body, extra limbs, bad anatomy, distorted face, unrealistic proportions, CGI, watermark, nudity, artifacts, oversaturated, duplicate limbs, fused fingers'
  try {
    const response = await axios.post(`${comfyURL}/prompt`, PromptJSON);
    return response.data.prompt_id;
  } catch (error: any) {
    console.error(
      "Error sending prompt:",
      error.response.data || error.message
    );
    return null;
  }
}

export async function getPromptHistory(promptId: string) {
  try {
    const response = await axios.get(`${comfyURL}/history/${promptId}`);
    //console.log("Prompt history response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching prompt history:", error);
    return null;
  }
}

export async function getImage(filename: string): Promise<string> {
  return `${comfyURL}/view?filename=${encodeURIComponent(filename)}`;
}

export async function uploadImageToS3(imageUrl: any, filename: any) {
  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
  });
  const imageBuffer = Buffer.from(response.data, "binary");

  const params = {
    Bucket: "dictionary-images-directory",
    Key: filename,
    Body: imageBuffer,
    ContentType: "image/png",
    ACL: "public-read",
  };

  const uploadResult = await new Promise<any>((resolve, reject) => {
    s3.upload(params, undefined, (err: Error, data: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
  return uploadResult.Location; // Public URL
}
