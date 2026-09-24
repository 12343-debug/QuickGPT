import Chat from "../models/Chat.js";
import User from "../models/User.js";
import imagekit from "../configs/imageKit.js";
import openai from "../configs/openai.js";
import hf from "../configs/huggingface.js";
import axios from "axios";

// ===============================
// Text Message Controller
// ===============================
export const textMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check credits
    if (req.user.credits < 1) {
      return res.json({
        success: false,
        message: "You don't have enough credits to use this feature",
      });
    }

    const { chatId, prompt } = req.body;

    // Find chat
    const chat = await Chat.findOne({
      userId,
      _id: chatId,
    });

    if (!chat) {
      return res.json({
        success: false,
        message: "Chat not found",
      });
    }

    // Push user message
    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    // Generate AI response
    const { choices } = await openai.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const reply = {
      ...choices[0].message,
      timestamp: Date.now(),
      isImage: false,
    };

    // Save assistant response
    chat.messages.push(reply);
    await chat.save();

    // Deduct credit
    await User.updateOne({ _id: userId }, { $inc: { credits: -1 } });

    return res.json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error("Text message failed:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Text generation failed",
    });
  }
};

export const imageMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check credits
    if (req.user.credits < 2) {
      return res.json({
        success: false,
        message: "You don't have enough credits to use this feature",
      });
    }

    const { prompt, chatId, isPublished } = req.body;

    // Find chat
    const chat = await Chat.findOne({
      userId,
      _id: chatId,
    });

    if (!chat) {
      return res.json({
        success: false,
        message: "Chat not found",
      });
    }

    // Save user message
    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    console.log("Generating image with Hugging Face...");

    // Generate image using Hugging Face
    const imageBlob = await hf.textToImage({
      provider: "nscale",
      model: "black-forest-labs/FLUX.1-schnell",
      inputs: prompt,
    });

    console.log("HF image generated successfully");

    // Convert Blob to Buffer
    const imageBuffer = Buffer.from(
      await imageBlob.arrayBuffer()
    );

    console.log("Image buffer size:", imageBuffer.length);

    // Upload image to ImageKit
    console.log("Starting ImageKit upload...");

    const FormData = (await import("form-data")).default;

const form = new FormData();

form.append("file", imageBuffer, {
  filename: `${Date.now()}.png`,
  contentType: "image/png",
});

form.append("fileName", `${Date.now()}.png`);
form.append("folder", "quickgpt");

const auth = Buffer.from(
  `${process.env.IMAGEKIT_PRIVATE_KEY}:`
).toString("base64");

const uploadResult = await axios.post(
  "https://upload.imagekit.io/api/v1/files/upload",
  form,
  {
    headers: {
      ...form.getHeaders(),
      Authorization: `Basic ${auth}`,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  }
);

const uploadResponse = uploadResult.data;

console.log("ImageKit upload successful:", uploadResponse.url);

    console.log(
      "ImageKit upload successful:",
      uploadResponse.url
    );

    // Create assistant reply
    const reply = {
      role: "assistant",
      content: uploadResponse.url,
      timestamp: Date.now(),
      isImage: true,
      isPublished,
    };

    // Save assistant message
    chat.messages.push(reply);

    console.log("Saving chat...");

    await chat.save();

    console.log("Chat saved successfully");

    // Deduct credits
    console.log("Deducting credits...");

    await User.updateOne(
      { _id: userId },
      { $inc: { credits: -2 } }
    );

    console.log("Credits deducted");

    return res.json({
      success: true,
      reply,
    });

  } catch (error) {
    console.error("========== IMAGE ERROR ==========");
    console.error("FULL ERROR:", error);
    console.error("NAME:", error?.name);
    console.error("MESSAGE:", error?.message);
    console.error("STATUS:", error?.status);
    console.error("RESPONSE:", error?.response);
    console.error("STACK:", error?.stack);
    console.error("================================");

    return res.status(error?.status || 500).json({
      success: false,
      message: error?.message || "Image generation failed",
    });
  }
};