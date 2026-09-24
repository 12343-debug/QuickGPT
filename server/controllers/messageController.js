import axios from "axios";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import imagekit from "../configs/imageKit.js";
import openai from "../configs/openai.js";

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

// ===============================
// Image Message Controller
// ===============================
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

    const response = await axios.post(
      "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
      {
        inputs: prompt,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
        timeout: 120000,
      },
    );

    console.log("Generating image with Hugging Face...");

const imageBlob = await hf.textToImage({
    model: "black-forest-labs/FLUX.1-schnell",
    inputs: prompt,
});

console.log("Hugging Face image generated successfully");

// Convert Blob to Buffer
const imageBuffer = Buffer.from(
    await imageBlob.arrayBuffer()
);

// Upload to ImageKit
const uploadResponse = await imagekit.upload({
    file: imageBuffer,
    fileName: `${Date.now()}.png`,
    folder: "quickgpt"
});

    console.log("Image uploaded to ImageKit");

    const reply = {
      role: "assistant",
      content: uploadResponse.url,
      timestamp: Date.now(),
      isImage: true,
      isPublished,
    };

    // Save assistant message
    chat.messages.push(reply);
    await chat.save();

    // Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -2 } });

    return res.json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error("========== OPENAI IMAGE ERROR ==========");
    console.error("Message:", error.message);
    console.error("Status:", error.status);
    console.error("Response:", error.response?.data);
    console.error("========================================");

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Image generation failed",
    });
  }
};
