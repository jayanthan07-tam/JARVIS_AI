"use client";

export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error"
  | "unsupported";

// Browser SpeechRecognition interface shim
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export class VoiceEngine {
  private recognition: any = null;
  private isListening = false;
  private isSpeaking = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private onStateChange?: (state: VoiceState) => void;
  private state: VoiceState = "idle";

  constructor(onStateChange?: (state: VoiceState) => void) {
    this.onStateChange = onStateChange;
    this.initRecognition();
    this.initVoiceSynthesis();
  }

  private setState(newState: VoiceState) {
    this.state = newState;
    this.onStateChange?.(newState);
  }

  public getState(): VoiceState {
    return this.state;
  }

  private initRecognition() {
    if (typeof window === "undefined") return;
    const win = window as unknown as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      this.setState("unsupported");
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
    } catch {
      this.setState("unsupported");
    }
  }

  private initVoiceSynthesis() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Look for sophisticated British or crisp English voices (J.A.R.V.I.S. style)
      const preferred =
        voices.find((v) => v.lang === "en-GB" && (v.name.includes("Daniel") || v.name.includes("Oliver") || v.name.includes("George"))) ||
        voices.find((v) => v.lang.startsWith("en-GB")) ||
        voices.find((v) => v.lang.startsWith("en-US") && v.name.includes("Natural")) ||
        voices.find((v) => v.lang.startsWith("en"));
      this.selectedVoice = preferred || null;
    };

    pickVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = pickVoice;
    }
  }

  public startListening(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (err: string) => void
  ): boolean {
    if (!this.recognition) {
      this.setState("unsupported");
      onError("Speech recognition is not supported in this browser. Please use text input or Chrome/Edge.");
      return false;
    }

    // Stop speaking if currently speaking
    this.stopSpeaking();

    try {
      this.isListening = true;
      this.setState("listening");

      this.recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            final += item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }

        if (final) {
          this.isListening = false;
          this.setState("processing");
          onTranscript(final.trim(), true);
        } else if (interim) {
          onTranscript(interim.trim(), false);
        }
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        this.setState("error");
        let msg = "Microphone error";
        if (event.error === "not-allowed") {
          msg = "Microphone access denied. Please grant permission in browser settings.";
        } else if (event.error === "no-speech") {
          msg = "No speech detected. Please speak into the microphone.";
        }
        onError(msg);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.state === "listening") {
          this.setState("idle");
        }
      };

      this.recognition.start();
      return true;
    } catch (e: any) {
      this.isListening = false;
      this.setState("error");
      onError(e?.message || "Failed to start microphone recognition.");
      return false;
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isListening = false;
    if (this.state === "listening") {
      this.setState("idle");
    }
  }

  public speak(text: string, onEnd?: () => void) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onEnd?.();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean markdown/symbols for clean voice reading
    const cleanText = text
      .replace(/[*_#`~[\]]/g, "")
      .replace(/https?:\/\/\S+/g, "link")
      .slice(0, 800); // speak concise portion

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = 1.05; // slightly swift and articulate
    utterance.pitch = 0.95; // deep, calm tone

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.setState("speaking");
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.setState("idle");
      onEnd?.();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.setState("idle");
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    if (this.state === "speaking") {
      this.setState("idle");
    }
  }
}
