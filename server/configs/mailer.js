let _resendClient = null;

async function getResendClient() {
    if (_resendClient) return _resendClient;
    try {
        const mod = await import("resend");
        // Support both default export and named export `Resend`
        const ResendClass = mod.default ?? mod.Resend;
        if (!ResendClass) throw new Error("Resend export not found in package");
        _resendClient = new ResendClass(process.env.RESEND_API_KEY);
        return _resendClient;
    } catch (err) {
        console.error("Failed to load 'resend' package:", err);
        throw err;
    }
}

export const sendLoginAlert = async (toEmail, userName) => {
    try {
        const resend = await getResendClient();
        await resend.emails.send({
            from: "QuickGPT <onboarding@resend.dev>",
            to: toEmail,
            subject: "New Login to Your QuickGPT Account",
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Hi ${userName},</h2>
                    <p>We noticed a new login to your <b>QuickGPT</b> account.</p>
                    <p><b>Time:</b> ${new Date().toLocaleString()}</p>
                    <p>If this wasn't you, please change your password immediately.</p>
                </div>
            `,
        });
    } catch (error) {
        console.error("Login alert email failed:", error?.message ?? error);
    }
};