import hf from "../configs/huggingface.js";

const MODEL = "black-forest-labs/FLUX.1-schnell";

// Tried in order. If one provider is down / doesn't host the model, the next is used.
const PROVIDERS = ["fal-ai", "nscale", "together", "hf-inference", "auto"];

const TOTAL_BUDGET_MS = 45_000; // stay under the Vercel function limit
const PER_TRY_MS = 25_000;

export class ImageGenError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function generateImage(prompt) {
  if (!process.env.HF_TOKEN) {
    throw new ImageGenError("HF_TOKEN is not set on the server.", 500);
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError = null;

  for (const provider of PROVIDERS) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) break;

    try {
      console.log(`[image] trying provider: ${provider}`);
      const blob = await hf.textToImage(
        { provider, model: MODEL, inputs: prompt },
        { signal: AbortSignal.timeout(Math.min(PER_TRY_MS, remaining)) }
      );

      const buffer = Buffer.from(await blob.arrayBuffer());
      if (!buffer.length) throw new Error("Empty image returned");

      console.log(`[image] success via ${provider}, ${buffer.length} bytes`);
      return { buffer, contentType: blob.type || "image/png" };
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || err);
      const status = err?.httpResponse?.status || err?.status;
      console.error(`[image] ${provider} failed (${status ?? "no status"}): ${msg}`);

      // Same token/billing is used for every provider, so retrying won't help
      if (status === 401 || status === 403 || /invalid (user )?token|unauthorized|permission/i.test(msg)) {
        throw new ImageGenError(
          "Hugging Face token rejected. Create a token with the 'Make calls to Inference Providers' permission and update HF_TOKEN on Vercel.",
          401
        );
      }
      if (status === 402 || /credit|quota|payment|billing/i.test(msg)) {
        throw new ImageGenError(
          "Hugging Face free credits are used up. Wait for the monthly reset or add credits / a different token.",
          402
        );
      }
      // anything else (404 model not on provider, 5xx, timeout) -> try next provider
    }
  }

  throw new ImageGenError(
    `Image generation failed on all providers. Last error: ${lastError?.message || "timeout"}`,
    502
  );
}