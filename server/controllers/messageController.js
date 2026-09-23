export const imageMessageController = async (req, res) => {
    try {
        const userId = req.user._id;

        // Check credits
        if (req.user.credits < 2) {
            return res.json({
                success: false,
                message: "You don't have enough credits to use this feature"
            });
        }

        const { prompt, chatId, isPublished } = req.body;

        // Find chat
        const chat = await Chat.findOne({
            userId,
            _id: chatId
        });

        if (!chat) {
            return res.json({
                success: false,
                message: "Chat not found"
            });
        }

        // Push user message
        chat.messages.push({
            role: "user",
            content: prompt,
            timestamp: Date.now(),
            isImage: false
        });

        // Encode prompt
        const encodedPrompt = encodeURIComponent(prompt);

        // ImageKit AI generation URL
        const generatedImageUrl =
            `${process.env.IMAGEKIT_URL_ENDPOINT}/ik-genimg-prompt-${encodedPrompt}/quickgpt/${Date.now()}.png?tr=w-800,h-800`;

        console.log("ImageKit URL:", generatedImageUrl);

        // Generate image
        const aiImageResponse = await axios.get(generatedImageUrl, {
            responseType: "arraybuffer",
            timeout: 120000,
            validateStatus: () => true
        });

        console.log("ImageKit status:", aiImageResponse.status);
        console.log("ImageKit headers:", aiImageResponse.headers);

        // Check ImageKit response
        if (aiImageResponse.status !== 200) {
            const ikError =
                aiImageResponse.headers["ik-error"] ||
                aiImageResponse.headers["IK-Error"] ||
                `ImageKit returned status ${aiImageResponse.status}`;

            console.error("IMAGEKIT ERROR:", ikError);

            return res.status(aiImageResponse.status).json({
                success: false,
                message: ikError
            });
        }

        // Convert image to Base64
        const base64Image =
            `data:image/png;base64,${Buffer.from(
                aiImageResponse.data,
                "binary"
            ).toString("base64")}`;

        // Upload to ImageKit Media Library
        const uploadResponse = await imagekit.upload({
            file: base64Image,
            fileName: `${Date.now()}.png`,
            folder: "quickgpt"
        });

        const reply = {
            role: "assistant",
            content: uploadResponse.url,
            timestamp: Date.now(),
            isImage: true,
            isPublished
        };

        // Save chat
        chat.messages.push(reply);
        await chat.save();

        // Deduct credits
        await User.updateOne(
            { _id: userId },
            { $inc: { credits: -2 } }
        );

        return res.json({
            success: true,
            reply
        });

    } catch (error) {

        console.error("========== IMAGE GENERATION ERROR ==========");
        console.error("Message:", error.message);
        console.error("Status:", error.response?.status);
        console.error("Data:", error.response?.data);
        console.error("Headers:", error.response?.headers);
        console.error("============================================");

        const message =
            error.response?.headers?.["ik-error"] ||
            error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Image generation failed";

        return res.status(error.response?.status || 500).json({
            success: false,
            message
        });
    }
};