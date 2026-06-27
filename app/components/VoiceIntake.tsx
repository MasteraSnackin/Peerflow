"use client";

import { useRef, useState } from "react";
import type { Paper } from "../data";

export type VoiceIntakeResult = {
  mode: "live" | "mock";
  record: {
    author: string;
    field: string;
    institution: string;
    paperId: string;
    summary: string;
    title: string;
  };
  slng: {
    confidence: number | null;
    language: string;
    model: string;
    requestId: string | null;
  };
  source: string;
  transcript: string;
};

type VoiceIntakeProps = {
  disabled?: boolean;
  onParsed: (result: VoiceIntakeResult) => void;
  papers: Paper[];
};

const SAMPLE_PHRASE =
  "I want to submit a paper about clinical AI retrieval";

export default function VoiceIntake({
  disabled = false,
  onParsed,
  papers,
}: VoiceIntakeProps) {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState<VoiceIntakeResult | null>(null);
  const [status, setStatus] = useState("Ready for SLNG voice intake");
  const chunksRef = useRef<BlobPart[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function submitAudio(audio?: Blob) {
    setError(null);
    setIsProcessing(true);
    setStatus("Parsing voice intake with SLNG");

    const formData = new FormData();
    formData.append("fallbackTranscript", SAMPLE_PHRASE);

    if (audio) {
      const file = new File([audio], "peerflow-voice-intake.webm", {
        type: audio.type || "audio/webm",
      });
      formData.append("audio", file);
    }

    try {
      const response = await fetch("/api/slng/intake", {
        body: formData,
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`SLNG intake returned ${response.status}`);
      }

      const nextResult = (await response.json()) as VoiceIntakeResult;
      setResult(nextResult);
      setStatus(
        nextResult.mode === "live"
          ? "Voice intake parsed by SLNG"
          : "Voice intake parsed with fallback",
      );
      onParsed(nextResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Voice intake failed");
      setStatus("Voice intake needs retry");
    } finally {
      setIsProcessing(false);
    }
  }

  async function startRecording() {
    setError(null);
    setResult(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not expose microphone recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const audio = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        void submitAudio(audio);
      });

      recorder.start();
      setIsRecording(true);
      setStatus("Recording author voice");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Microphone permission was not granted.",
      );
      setStatus("Voice intake needs microphone access");
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
    setIsRecording(false);
    setStatus("Sending recording to SLNG");
  }

  function cancelRecording() {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);
    setStatus("Ready for SLNG voice intake");
  }

  return (
    <div className="rounded-lg border border-[#d7ded9] bg-[#f9fbfa] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#243632]">
            SLNG voice intake
          </p>
          <p className="mt-1 text-xs leading-5 text-[#60706c]">
            Author speaks a paper request, then Peerflow extracts the structured
            intake record.
          </p>
        </div>
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ${
            result?.mode === "live"
              ? "bg-[#dff6ee] text-[#11775f]"
              : "bg-[#edf2ef] text-[#55716a]"
          }`}
        >
          {result?.mode === "live" ? "SLNG live" : "SLNG ready"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!isRecording ? (
          <button
            className="rounded-md bg-[#17211f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b3b37] disabled:cursor-not-allowed disabled:bg-[#6d7b77]"
            disabled={disabled || isProcessing}
            onClick={startRecording}
            type="button"
          >
            Record voice
          </button>
        ) : (
          <button
            className="rounded-md bg-[#b64040] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#8f3030]"
            onClick={stopRecording}
            type="button"
          >
            Stop and parse
          </button>
        )}
        <button
          className="rounded-md border border-[#c8d2ce] bg-white px-4 py-3 text-sm font-semibold text-[#243632] transition hover:bg-[#f2f5f3] disabled:cursor-not-allowed disabled:text-[#8a9894]"
          disabled={disabled || isProcessing || isRecording}
          onClick={() => void submitAudio()}
          type="button"
        >
          Parse sample phrase
        </button>
        {isRecording ? (
          <button
            className="rounded-md border border-[#c8d2ce] bg-white px-4 py-3 text-sm font-semibold text-[#243632] transition hover:bg-[#f2f5f3]"
            onClick={cancelRecording}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-xs font-medium text-[#60706c]">{status}</p>
      {error ? (
        <p className="mt-2 text-xs font-medium text-[#9a3f3f]">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-4 divide-y divide-[#d9e1dd] border-y border-[#d9e1dd]">
          <div className="py-3">
            <p className="text-xs font-semibold uppercase text-[#55716a]">
              Transcript
            </p>
            <p className="mt-1 text-sm leading-6 text-[#40514d]">
              &quot;{result.transcript}&quot;
            </p>
            <p className="mt-2 text-xs text-[#60706c]">{result.source}</p>
          </div>
          <dl className="grid gap-3 py-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-[#55716a]">
                Title
              </dt>
              <dd className="mt-1 font-medium text-[#243632]">
                {result.record.title}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#55716a]">
                Field
              </dt>
              <dd className="mt-1 font-medium text-[#243632]">
                {result.record.field}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#55716a]">
                Author
              </dt>
              <dd className="mt-1 font-medium text-[#243632]">
                {result.record.author}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#55716a]">
                Institution
              </dt>
              <dd className="mt-1 font-medium text-[#243632]">
                {result.record.institution}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-[#60706c]">
          Suggested demo phrase: &quot;{SAMPLE_PHRASE}&quot;.
        </p>
      )}

      <p className="mt-3 text-xs leading-5 text-[#60706c]">
        Demo queue: {papers.length} open-access paper records can receive voice
        intake.
      </p>
    </div>
  );
}
