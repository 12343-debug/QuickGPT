import { InferenceClient } from "@huggingface/inference";

// .trim() protects against stray spaces/newlines when pasting the token into Vercel
const hf = new InferenceClient((process.env.HF_TOKEN || "").trim());

export default hf;