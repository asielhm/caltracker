// Request the rear camera without audio; the browser owns its permission prompt.
export async function openRearCamera(
  mediaDevices = globalThis.navigator?.mediaDevices,
) {
  if (!mediaDevices?.getUserMedia) throw new Error("CAMERA_UNAVAILABLE");
  return mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1600 },
      height: { ideal: 1200 },
    },
    audio: false,
  });
}
export function stopCamera(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
export async function captureCameraPhoto(video, documentObject = document) {
  if (!video.videoWidth || !video.videoHeight)
    throw new Error("Wait for the camera preview before taking a photo.");
  const scale = Math.min(
    1,
    1600 / Math.max(video.videoWidth, video.videoHeight),
  );
  const canvas = documentObject.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error(
      "Camera capture is unavailable. Use the phone camera instead.",
    );
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.88),
  );
  if (!blob)
    throw new Error("The photo could not be captured. Please try again.");
  return new File([blob], "meal-photo.jpg", { type: "image/jpeg" });
}
