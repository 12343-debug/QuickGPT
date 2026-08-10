import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);


export const sendLoginAlert = async (toEmail, userName) => {
    try {
        await resend.emails.send({
            from: "QuickGPT <onboarding@resend.dev>", // works out of the box, no domain setup needed
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
        console.error("Login alert email failed:", error.message);
    }
};