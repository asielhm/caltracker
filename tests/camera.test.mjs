import { test } from "node:test";
import assert from "node:assert/strict";
import {
  openRearCamera,
  stopCamera,
  captureCameraPhoto,
} from "../dist/camera.js";
test("requests the rear camera without audio", async () => {
  let options;
  const stream = {};
  assert.equal(
    await openRearCamera({
      getUserMedia: async (input) => {
        options = input;
        return stream;
      },
    }),
    stream,
  );
  assert.equal(options.audio, false);
  assert.equal(options.video.facingMode.ideal, "environment");
});
test("stops every track when camera is closed", () => {
  let stopped = 0;
  stopCamera({
    getTracks: () => [{ stop: () => stopped++ }, { stop: () => stopped++ }],
  });
  assert.equal(stopped, 2);
  stopCamera(null);
});
test("unsupported browsers and unready previews get clear fallback errors", async () => {
  await assert.rejects(openRearCamera({}), /CAMERA_UNAVAILABLE/);
  await assert.rejects(
    captureCameraPhoto({ videoWidth: 0, videoHeight: 0 }, {}),
    /Wait for the camera preview/,
  );
});
