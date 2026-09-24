import Chat from "../models/Chat.js";
import User from "../models/User.js";
import openai from "../configs/openai.js";
import { generateImage } from "../utils/generateImage.js";
import imagekit from "../configs/imageKit.js";

// ===============================
// Text Message Controller
// ===============================
export const textMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    if (req.user.credits < 1) {
      return res.json({
        success: false,
        message: "You don't have enough credits to use this feature",
      });
    }

    const { chatId, prompt } = req.body;

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

    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

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

    chat.messages.push(reply);
    await chat.save();

    await User.updateOne(
      { _id: userId },
      { $inc: { credits: -1 } }
    );

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
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);

export const imageMessageController = async (req, res) => {
  const t0 = Date.now();
  const step = (msg) => console.log(`[image v2] +${Date.now() - t0}ms ${msg}`);
  try {
    step("request received");
    const userId = req.user._id;

    if (req.user.credits < 2) {
      return res.json({
        success: false,
        message: "You don't have enough credits to use this feature",
      });
    }

    const { prompt, chatId, isPublished } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.json({ success: false, message: "Prompt is required" });
    }

    const chat = await Chat.findOne({ userId, _id: chatId });

    if (!chat) {
      return res.json({ success: false, message: "Chat not found" });
    }

    // 1) Generate image with Hugging Face (multi-provider fallback)
    const { buffer, contentType } = await generateImage(prompt.trim());
    step(`HF done, ${buffer.length} bytes`);
    const ext = contentType.includes("jpeg") ? "jpg" : "png";

    // 2) Upload to ImageKit
    step("uploading to ImageKit");
    const uploadResponse = await withTimeout(
      imagekit.upload({
        file: buffer.toString("base64"),
        fileName: `${Date.now()}.${ext}`,
        folder: "quickgpt",
      }),
      20000,
      "ImageKit upload"
    );
    step(`ImageKit done: ${uploadResponse.url}`);

    // 3) Save both messages together only after everything succeeded
    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    const reply = {
      role: "assistant",
      content: uploadResponse.url,
      timestamp: Date.now(),
      isImage: true,
      isPublished: !!isPublished,
    };
    chat.messages.push(reply);
    await chat.save();
    step("chat saved");

    // 4) Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -2 } });

    return res.json({ success: true, reply });
  } catch (error) {
    step(`FAILED: ${error?.message}`);
    console.error("IMAGE ERROR:", error?.message, error?.response?.data || "");

    // Always 200 + success:false so the frontend shows the message in a toast
    return res.json({
      success: false,
      message:
        error?.response?.data?.message ||
        error?.message ||
        "Image generation failed",
    });
  }
};