"use client";

import { useEffect, useMemo, useState } from "react";

type VoiceOutputButtonProps = {
  className?: string;
  disabled?: boolean;
  label?: string;
  text: string;
};

function cleanSpeechText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 1400);
}

function browserSupportsSpeech() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

export default function VoiceOutputButton({
  className,
  disabled = false,
  label = "Speak",
  text,
}: VoiceOutputButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechText = useMemo(() => cleanSpeechText(text), [text]);
  const isSupported =
    typeof window === "undefined" ? true : browserSupportsSpeech();

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function toggleSpeech() {
    if (!browserSupportsSpeech() || !speechText) {
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  return (
    <button
      aria-pressed={isSpeaking}
      className={className}
      disabled={disabled || !isSupported || !speechText}
      onClick={toggleSpeech}
      title={isSupported ? label : "Voice output unavailable"}
      type="button"
    >
      {isSpeaking ? "Stop voice" : label}
    </button>
  );
}
