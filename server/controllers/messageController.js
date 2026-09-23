import axios from "axios"
import Chat from "../models/Chat.js"
import User from "../models/User.js"
import imagekit from "../configs/imageKit.js"
import openai from '../configs/openai.js'

const getProviderErrorMessage = (error) => {
    if (error?.status === 429) {
        return "The AI provider rejected the request with a 429 error. Your Gemini API key may be rate-limited, out of quota, or missing billing."
    }

    if (error?.status === 401 || error?.status === 403) {
        return "The AI provider rejected your API key. Check that GEMINI_API_KEY is valid and active."
    }

    return error.message
}


// Text-based AI Chat Message Controller
export const textMessageController = async (req, res) => {
    try {
        const userId = req.user._id

         // Check credits
        if(req.user.credits < 1){
            return res.json({success: false, message: "You don't have enough credits to use this feature"})
        }

        const {chatId, prompt} = req.body

        const chat = await Chat.findOne({userId, _id: chatId})
        if (!chat) {
            return res.json({ success: false, message: "Chat not found" })
        }

        chat.messages.push({role: "user", content: prompt, timestamp: Date.now(), isImage: false})

        const { choices } = await openai.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
    });

    const reply = {...choices[0].message, timestamp: Date.now(), isImage: false}
    res.json({success: true, reply})

    chat.messages.push(reply)
    await chat.save()
    await User.updateOne({_id: userId}, {$inc: {credits: -1}})

    } catch (error) {
        console.error("Text message failed:", error)
        res.json({success: false, message: getProviderErrorMessage(error)})
    }
}

// Image Generation Message Controller
export const imageMessageController = async (req, res) => {
    try {
        const userId = req.user._id;
        // Check credits
        if(req.user.credits < 2){
            return res.json({success: false, message: "You don't have enough credits to use this feature"})
        }
        const {prompt, chatId, isPublished} = req.body
        // Find chat
        const chat = await Chat.findOne({userId, _id: chatId})
        if (!chat) {
            return res.json({ success: false, message: "Chat not found" })
        }

         // Push user message
         chat.messages.push({
            role: "user", 
            content: prompt, 
            timestamp: Date.now(), 
            isImage: false});

        // Encode the prompt
        const encodedPrompt = encodeURIComponent(prompt)

        // Construct ImageKit AI generation URL
        const generatedImageUrl = `${process.env.IMAGEKIT_URL_ENDPOINT}/ik-genimg-prompt-${encodedPrompt}/quickgpt/${Date.now()}.png?tr=w-800,h-800`;

        // Trigger generation by fetching from ImageKit
        const aiImageResponse = await axios.get(generatedImageUrl, {responseType: "arraybuffer"})

        // Convert to Base64
        const base64Image = `data:image/png;base64,${Buffer.from(aiImageResponse.data,"binary").toString('base64')}`;

        // Upload to ImageKit Media Library
        const uploadResponse = await imagekit.upload({
            file: base64Image,
            fileName: `${Date.now()}.png`,
            folder: "quickgpt"
        })

        const reply = {
                role: 'assistant',
                content: uploadResponse.url,
                timestamp: Date.now(), 
                isImage: true,
                isPublished
        }

         res.json({success: true, reply})

         chat.messages.push(reply)
         await chat.save()

          await User.updateOne({_id: userId}, {$inc: {credits: -2}})

    } catch (error) {
        console.error("Image message failed:", error)
        res.json({ success: false, message: getProviderErrorMessage(error) });
    }
}
