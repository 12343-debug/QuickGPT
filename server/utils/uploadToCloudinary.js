import crypto from "node:crypto";

// Cloudinary fallback for image hosting, used if ImageKit is unusable.
// Needs 3 env vars from your Cloudinary dashboard (cloudinary.com/console):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
// Docs: https://cloudinary.com/documentation/image_upload_api_reference

export async function uploadToCloudinary(buffer, fileName) {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary env vars missing: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET on Vercel."
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "quickgpt";

  // Only params actually sent (besides file/api_key/signature) go into the
  // signature string, alphabetically sorted, per Cloudinary's spec.
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

  const form = new FormData();
  form.append("file", `data:image/png;base64,${buffer.toString("base64")}`);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);
  form.append("public_id", fileName.replace(/\.[a-z0-9]+$/i, ""));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(20000),
  });

  const rawText = await response.text();
  let data = null;
  try {
    data = JSON.parse(rawText);
  } catch {
    // non-JSON response
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `Cloudinary upload failed with HTTP ${response.status}: ${rawText.slice(0, 300)}`
    );
  }

  if (!data?.secure_url) {
    throw new Error("Cloudinary upload succeeded but returned no URL.");
  }

  return { url: data.secure_url };
}