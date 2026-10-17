import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { COR_UPLOAD } from "@/utils/constants";

type Phase = "idle" | "starting" | "live" | "captured";

interface CorCameraCaptureProps {
  /** Called with the captured photo, or null after "Retake". The page validates and submits it. */
  onCapture: (file: File | null) => void;
  disabled?: boolean;
}

const MAX_SIDE = 1600; // longest edge of the saved photo: small file, text still readable
const QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6, 0.5]; // retry lower quality if the photo is over the upload size limit

/** Turns a getUserMedia failure into a clear message. Every message points to the upload fallback. */
function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was blocked. Allow camera access in your browser's site settings and try again, or upload a file instead.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device. Upload a file instead.";
    case "NotReadableError":
    case "AbortError":
      return "The camera is being used by another app or tab. Close it and try again, or upload a file instead.";
    default:
      return "The camera could not be started. Try again, or upload a file instead.";
  }
}

/**
 * Live camera preview + capture. The photo becomes a normal File (JPEG), so the existing COR validation and
 * submission run unchanged. Taking a photo does NOT verify or approve anything: staff still review the COR.
 */
export default function CorCameraCapture({ onCapture, disabled = false }: CorCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ url: string; name: string; sizeKb: number } | null>(null);

  // getUserMedia only exists on HTTPS pages (or localhost) and in browsers with a camera API.
  const supported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Safety net: the camera is always released when this component goes away (tab switch, route change, submit).
  useEffect(() => stopCamera, [stopCamera]);

  // Free the preview image URL when the photo is replaced or the component unmounts.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  const startCamera = async () => {
    setError(null);
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // ideal = a preference, never a hard requirement: rear camera on phones, any camera on laptops.
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera(); // unmounted while the permission prompt was open
        return;
      }
      video.srcObject = stream;
      await video.play();
      setPhase("live");
    } catch (err) {
      stopCamera();
      setPhase("idle");
      setError(describeCameraError(err));
    }
  };

  const turnOff = () => {
    stopCamera();
    setPhase("idle");
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("The camera is not ready yet. Wait a moment and try again.");
      return;
    }
    setError(null);

    // Draw the current frame to a canvas, scaled down so the longest edge is MAX_SIDE.
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Could not take the photo. Try again, or upload a file instead.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Lower the JPEG quality step by step until the photo fits the upload limit.
    let blob: Blob | null = null;
    for (const quality of QUALITY_STEPS) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= COR_UPLOAD.MAX_BYTES) break;
    }
    if (!blob) {
      setError("Could not take the photo. Try again, or upload a file instead.");
      return;
    }

    const file = new File([blob], `cor-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    stopCamera(); // photo taken: release the camera right away
    setPhoto({ url: URL.createObjectURL(file), name: file.name, sizeKb: Math.round(file.size / 1024) });
    setPhase("captured");
    onCapture(file);
  };

  const retake = () => {
    setPhoto(null);
    onCapture(null); // the old photo can no longer be submitted
    void startCamera();
  };

  if (!supported) {
    return <Alert kind="warn">This browser or connection cannot open the camera (it needs HTTPS or localhost). Use the "Upload a file" tab instead.</Alert>;
  }

  const showVideo = phase === "live" || phase === "starting";

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-xl border border-line bg-black">
        {/* The <video> stays mounted so its ref exists before the stream starts. */}
        <video
          ref={videoRef}
          className={`h-full w-full object-contain ${showVideo ? "" : "hidden"}`}
          playsInline
          muted
          aria-label="Live camera preview"
        />
        {phase === "captured" && photo && <img src={photo.url} alt="Captured COR photo preview" className="h-full w-full object-contain" />}
        {phase === "idle" && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white/80">
            Camera is off. Press "Start camera" to take a photo of your COR.
          </div>
        )}
        {phase === "starting" && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm text-white" role="status">
            Starting camera… allow access if your browser asks.
          </div>
        )}
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      <div className="row-actions" style={{ justifyContent: "center" }}>
        {phase === "idle" && (
          <Button onClick={() => void startCamera()} disabled={disabled}>
            Start camera
          </Button>
        )}
        {phase === "starting" && <Button loading disabled>Starting…</Button>}
        {phase === "live" && (
          <>
            <Button onClick={() => void capture()} disabled={disabled}>
              Capture photo
            </Button>
            <Button variant="ghost" onClick={turnOff} disabled={disabled}>
              Turn off camera
            </Button>
          </>
        )}
        {phase === "captured" && (
          <Button variant="ghost" onClick={retake} disabled={disabled}>
            Retake
          </Button>
        )}
      </div>

      {phase === "captured" && photo ? (
        <p className="subtle" style={{ textAlign: "center" }}>
          Photo ready ({photo.sizeKb} KB). Check that the text is readable, then press Submit COR. Not happy with it? Retake.
        </p>
      ) : (
        <p className="subtle" style={{ textAlign: "center" }}>
          Lay the COR flat in good light and keep all four corners and every line of text inside the frame.
        </p>
      )}
    </div>
  );
}