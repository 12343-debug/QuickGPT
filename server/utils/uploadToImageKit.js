// Uploads directly to ImageKit's REST API instead of using the deprecated
// "imagekit" npm package, which can swallow real error details on failure.
// Docs: https://docs.imagekit.io/api-reference/upload-file-api/server-side-file-upload

export async function uploadToImageKit(buffer, fileName) {
  const privateKey = (process.env.IMAGEKIT_PRIVATE_KEY || "").trim();

  if (!privateKey) {
    throw new Error("IMAGEKIT_PRIVATE_KEY is not set on the server.");
  }

  const form = new FormData();
  form.append("file", new Blob([buffer]), fileName);
  form.append("fileName", fileName);
  form.append("folder", "quickgpt");
  form.append("useUniqueFileName", "true");

  // ImageKit's server-side upload API uses HTTP Basic Auth with the
  // private key as the username and an empty password.
  const auth = Buffer.from(`${privateKey}:`).toString("base64");

  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: form,
    signal: AbortSignal.timeout(20000),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const msg =
      data?.message ||
      `ImageKit upload failed with HTTP ${response.status} ${response.statusText}`;
    throw new Error(msg);
  }

  if (!data?.url) {
    throw new Error("ImageKit upload succeeded but returned no URL.");
  }

  return data; // { url, fileId, ... }
}