import { useEffect, useRef, useCallback } from "react";
import { playScanSound } from "../utils/audio-feedback";

export interface UseBarcodeScannerOptions {
  onScan: (barcode: string, quantityMultiplier?: number) => void;
  enabled?: boolean;
  playFeedbackAudio?: boolean;
  allowInInputs?: boolean;
  minBarcodeLength?: number;
  maxKeystrokeIntervalMs?: number;
}

/**
 * High-performance HID Barcode Scanner Hook.
 * Intercepts physical USB/Bluetooth laser scanner bursts (keystroke interval < 45ms)
 * and supports cashier quantity prefix multipliers (e.g. typing '12*' then scanning).
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  playFeedbackAudio = true,
  allowInInputs = false,
  minBarcodeLength = 3,
  maxKeystrokeIntervalMs = 45,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>("");
  const multiplierRef = useRef<number>(1);
  const lastKeyTimeRef = useRef<number>(0);

  const handleScan = useCallback(
    (code: string, multiplier: number) => {
      if (playFeedbackAudio) {
        playScanSound("success");
      }
      onScan(code, multiplier);
    },
    [onScan, playFeedbackAudio]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Check if user is typing inside an input/textarea
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isInput && !allowInInputs) {
        return;
      }

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // 2. If human pause (> 60ms between characters), reset scan buffer
      if (timeSinceLastKey > maxKeystrokeIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      // 3. Check for Terminator key (Enter / Return from scanner)
      if (e.key === "Enter") {
        const fullBuffer = bufferRef.current.trim();
        if (fullBuffer.length >= minBarcodeLength) {
          e.preventDefault();
          e.stopPropagation();

          // Check if buffer contains a multiplier (e.g. '12*7591234567890')
          if (fullBuffer.includes("*")) {
            const [multStr, rawCode] = fullBuffer.split("*");
            const parsedMult = parseInt(multStr || "1", 10);
            const mult = !isNaN(parsedMult) && parsedMult > 0 ? parsedMult : 1;
            const code = rawCode || "";
            if (code.length >= minBarcodeLength) {
              handleScan(code, mult);
            }
          } else {
            handleScan(fullBuffer, multiplierRef.current);
          }
        }

        // Reset buffers
        bufferRef.current = "";
        multiplierRef.current = 1;
        return;
      }

      // 4. Accumulate single characters (printable digits and letters)
      if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [
    enabled,
    allowInInputs,
    minBarcodeLength,
    maxKeystrokeIntervalMs,
    handleScan,
  ]);
}
