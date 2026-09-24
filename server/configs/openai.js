import OpenAI from "openai";

const key = (process.env.GROQ_API_KEY || "").trim();

if (!key) {
  console.error("GROQ_API_KEY is missing - text chat will fail");
}

// Never log the key itself (Vercel logs are visible in the dashboard)
const openai = new OpenAI({
  apiKey: key || "missing-key",
  baseURL: "https://api.groq.com/openai/v1",
});

export default openai;