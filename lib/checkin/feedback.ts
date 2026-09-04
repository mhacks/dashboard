import type { ScanSeverity } from "./outcomes";

/**
 * Sound and vibration for scan results.
 *
 * A check-in desk is loud and a volunteer is usually looking at the person
 * rather than the screen, so the beep is doing real work — it is often the
 * first signal they get that the scan landed at all.
 */

let context: AudioContext | null = null;

/**
 * Must be called from inside a real user gesture — iOS refuses to start an
 * AudioContext any other way, and a context created on mount stays suspended
 * forever. The scanner calls this from the "Start scanning" tap.
 */
export function unlockFeedbackAudio() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
  } catch {
    // No Web Audio. Vibration and the on-screen flood still carry the result.
  }
}

const TONE: Record<ScanSeverity, { frequency: number; beeps: number }> = {
  go: { frequency: 880, beeps: 1 },
  warn: { frequency: 520, beeps: 2 },
  stop: { frequency: 220, beeps: 2 },
};

const BEEP_MS = 90;
const GAP_MS = 60;

export function playScanTone(severity: ScanSeverity) {
  if (!context || context.state !== "running") return;

  const { frequency, beeps } = TONE[severity];

  for (let index = 0; index < beeps; index++) {
    const start = context.currentTime + index * ((BEEP_MS + GAP_MS) / 1000);
    const end = start + BEEP_MS / 1000;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "square";

    // Ramped rather than switched: an abrupt stop on a square wave clicks.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
}

const PATTERN: Record<ScanSeverity, number[]> = {
  go: [40],
  warn: [70, 60, 70],
  stop: [90, 60, 90],
};

/** Android only — iOS Safari has no vibration API. Silently a no-op there. */
export function vibrateForScan(severity: ScanSeverity) {
  try {
    navigator.vibrate?.(PATTERN[severity]);
  } catch {
    // Ignored: some browsers throw when the page isn't visible.
  }
}

export function signalScan(severity: ScanSeverity) {
  playScanTone(severity);
  vibrateForScan(severity);
}
