import OpenAI from "openai";

const key = process.env.GROQ_API_KEY;

console.log("Length:", key.length);
console.log("First 15 chars:", JSON.stringify(key.slice(0, 15)));

for (let i = 0; i < key.length; i++) {
  if (key.charCodeAt(i) > 255) {
    console.log(
      `Invalid character at index ${i}: '${key[i]}' (${key.charCodeAt(i)})`
    );
  }
}

const openai = new OpenAI({
  apiKey: key.trim(),
  baseURL: "https://api.groq.com/openai/v1",
});

export default openai;