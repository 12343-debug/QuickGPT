import OpenAI from "openai";

const openaiImage = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export default openaiImage;