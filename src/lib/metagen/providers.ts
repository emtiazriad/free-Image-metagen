import type { ProviderId } from "./types";

const MAX_IMAGE_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let { width, height } = img;
      
      // Scale down if larger than max dimension
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const scale = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };
    
    img.src = url;
  });
}

export async function fileToBase64(file: File): Promise<{ base64: string; mime: string }>
{
  // Compress image first to reduce payload size
  const compressedBlob = await compressImage(file);
  const mime = "image/jpeg";

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(compressedBlob);
  });

  const comma = dataUrl.indexOf(",");
  if (comma === -1) {
    throw new Error("Failed to encode image as base64.");
  }
  const base64 = dataUrl.slice(comma + 1);
  return { base64, mime };
}

export async function generateWithProvider(opts: {
  provider: ProviderId;
  apiKey: string;
  prompt: string;
  image: { base64: string; mime: string };
}): Promise<string> {
  const { provider } = opts;
  if (provider === "gemini") return generateWithGemini(opts);
  return generateWithGroq(opts);
}

export async function testApiKeyWithProvider(opts: {
  provider: ProviderId;
  apiKey: string;
}): Promise<{ ok: boolean; status: number; detail?: string }> {
  const { provider, apiKey } = opts;
  if (!apiKey.trim()) return { ok: false, status: 0, detail: "Missing key" };

  if (provider === "gemini") {
    // Lightweight call (no image) to validate key
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, { method: "GET" });
    if (resp.ok) return { ok: true, status: resp.status };
    const t = await resp.text();
    return { ok: false, status: resp.status, detail: t };
  }

  // Groq OpenAI-compatible endpoint
  const url = "https://api.groq.com/openai/v1/models";
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (resp.ok) return { ok: true, status: resp.status };
  const t = await resp.text();
  return { ok: false, status: resp.status, detail: t };
}

async function generateWithGemini(opts: {
  apiKey: string;
  prompt: string;
  image: { base64: string; mime: string };
}): Promise<string> {
  const { apiKey, prompt, image } = opts;

  // Gemini REST API (client-side; user-provided key stored locally)
  // v1beta model names change over time; use a currently available model.
  // The ListModels response in the browser shows gemini-2.5-flash is available.
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey,
  )}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: image.mime,
                data: image.base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Gemini error [${resp.status}]: ${t}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n");
  if (!text) throw new Error("Gemini returned no text.");
  return text;
}

async function generateWithGroq(opts: {
  apiKey: string;
  prompt: string;
  image: { base64: string; mime: string };
}): Promise<string> {
  const { apiKey, prompt, image } = opts;

  // Groq OpenAI-compatible endpoint with vision models
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const model = "meta-llama/llama-4-scout-17b-16e-instruct";

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${image.mime};base64,${image.base64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Groq error [${resp.status}]: ${t}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no text.");
  return text;
}
