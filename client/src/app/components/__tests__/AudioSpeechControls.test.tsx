// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/supabase", () => ({
  edgeFn: (name: string) => `/functions/v1/${name}`,
  edgeHeaders: () => ({ "Content-Type": "application/json" }),
}));

import { AudioRecorder } from "../AudioRecorder";
import { ListenButton } from "../ListenButton";
import { AssessmentProvider } from "../../store/AssessmentContext";

function renderRecorder() {
  render(
    <AssessmentProvider>
      <AudioRecorder taskId="memory" onRecordingComplete={vi.fn()} />
    </AssessmentProvider>,
  );
}

describe("audio and speech controls", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows a disabled listen control when speech synthesis is unavailable", () => {
    Reflect.deleteProperty(window, "speechSynthesis");
    Reflect.deleteProperty(window, "SpeechSynthesisUtterance");

    render(<ListenButton text="בדיקת שמע" size="lg" />);

    expect(screen.getByRole("button", { name: "השמע הוראות" })).toBeDisabled();
    expect(screen.getByText("אין תמיכת שמע")).toBeInTheDocument();
  });

  it("uses an available Hebrew voice for speech synthesis", async () => {
    const spoken: Array<{ text: string; voice: SpeechSynthesisVoice | null }> = [];
    const hebrewVoice = { lang: "he-IL" } as SpeechSynthesisVoice;

    vi.stubGlobal("SpeechSynthesisUtterance", class {
      lang = "";
      rate = 1;
      voice: SpeechSynthesisVoice | null = null;
      onend: ((event: SpeechSynthesisEvent) => void) | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
      text: string;

      constructor(text: string) {
        this.text = text;
      }
    });
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      getVoices: vi.fn(() => [hebrewVoice]),
      speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
        spoken.push({ text: utterance.text, voice: utterance.voice });
        utterance.onend?.({} as SpeechSynthesisEvent);
      }),
    });

    render(<ListenButton text="בדיקת שמע" size="lg" />);
    await userEvent.click(screen.getByRole("button", { name: "השמע הוראות" }));

    await waitFor(() => expect(spoken).toEqual([{ text: "בדיקת שמע", voice: hebrewVoice }]));
  });

  it("shows a localized microphone support error when recording APIs are unavailable", async () => {
    Reflect.deleteProperty(window, "MediaRecorder");
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });

    renderRecorder();

    await userEvent.click(screen.getByRole("button", { name: "התחל הקלטה" }));

    expect(screen.getByText("המכשיר או הדפדפן אינם תומכים בהקלטת קול. פנה לקלינאי.")).toBeInTheDocument();
  });
});
