"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CorpusArticle } from "../data";
import VoiceOutputButton from "./VoiceOutputButton";

type AidaAnswer = {
  answer: string;
  confidence: string;
  coverage: string;
  citations: string[];
  mode: "live" | "refused";
  source: string;
  query: string;
  articles: CorpusArticle[];
  providerStatuses?: string[];
};

type ChatMessage = {
  answer?: AidaAnswer;
  id: string;
  role: "aida" | "user";
  text: string;
};

type VoiceRecognitionResult = ArrayLike<{
  transcript?: string;
}>;

type VoiceRecognitionEvent = {
  results: ArrayLike<VoiceRecognitionResult>;
};

type VoiceRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type VoiceRecognitionConstructor = new () => VoiceRecognition;

type VoiceWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  };

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function recognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  const voiceWindow = window as VoiceWindow;
  return voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition ?? null;
}

function transcriptFromEvent(event: VoiceRecognitionEvent) {
  const phrases: string[] = [];

  for (let index = 0; index < event.results.length; index += 1) {
    const transcript = event.results[index]?.[0]?.transcript?.trim();
    if (transcript) {
      phrases.push(transcript);
    }
  }

  return phrases.join(" ").replace(/\s+/g, " ").trim();
}

function answerVoiceText(answer: AidaAnswer | null) {
  if (!answer) {
    return "";
  }

  return [
    `Aida answer: ${answer.answer}`,
    `Evidence coverage: ${answer.coverage}.`,
    answer.citations.length > 0
      ? `Citations: ${answer.citations.join(", ")}.`
      : "No supporting citations were returned.",
  ].join(" ");
}

export default function AidaChatbot() {
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(() =>
    typeof window === "undefined" ? true : Boolean(recognitionConstructor()),
  );
  const [voiceStatus, setVoiceStatus] = useState("Keyboard ready");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "aida-ready",
      role: "aida",
      text: "Aida is ready for a cited research question.",
    },
  ]);

  const latestAnswer = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "aida" && message.answer)?.answer ??
      null,
    [messages],
  );
  const latestCitedArticles = latestAnswer
    ? latestAnswer.citations
        .map((citation) =>
          latestAnswer.articles.find((article) => article.id === citation),
        )
        .filter((article): article is CorpusArticle => Boolean(article))
    : [];

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  async function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const question = input.replace(/\s+/g, " ").trim();
    if (!question || isSending) {
      return;
    }

    setInput("");
    setIsSending(true);
    setMessages((current) => [
      ...current,
      {
        id: makeId("user"),
        role: "user",
        text: question,
      },
    ]);

    try {
      const response = await fetch("/api/aida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const result = (await response.json()) as AidaAnswer;
      setMessages((current) => [
        ...current,
        {
          answer: result,
          id: makeId("aida"),
          role: "aida",
          text: result.answer,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: makeId("aida"),
          role: "aida",
          text: "Aida could not reach the live answer route, so it is refusing instead of making an unsupported claim.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function toggleVoiceInput() {
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setVoiceSupported(false);
      setVoiceStatus("Voice input unavailable");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setVoiceStatus("Voice captured");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
      const transcript = transcriptFromEvent(event);
      if (transcript) {
        setInput((current) =>
          current.trim() ? `${current.trim()} ${transcript}` : transcript,
        );
        setVoiceStatus("Voice captured");
      }
    };
    recognition.onerror = () => {
      setVoiceStatus("Voice input needs retry");
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setVoiceStatus("Listening");
  }

  return (
    <section className="rounded-lg border border-[#d7ded9] bg-white p-5 shadow-sm">
      <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <div>
          <p className="text-xs font-semibold uppercase text-[#55716a]">
            Aida chat
          </p>
          <h2 className="mt-2 max-w-xl text-2xl font-semibold leading-tight text-[#243632]">
            Ask with keyboard or voice. Hear cited answers back.
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-[#51625e]">
            <div className="flex items-center justify-between gap-3 border-b border-[#d9e1dd] pb-3">
              <span>Input</span>
              <span className="font-semibold text-[#243632]">
                Keyboard or voice
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-[#d9e1dd] pb-3">
              <span>Output</span>
              <span className="font-semibold text-[#243632]">
                Text or speech
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Guardrail</span>
              <span className="font-semibold text-[#243632]">
                No citation, no claim
              </span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <VoiceOutputButton
              className="rounded-md border border-[#c8d2ce] bg-white px-3 py-2 text-xs font-semibold text-[#243632] transition hover:bg-[#f2f5f3] disabled:cursor-not-allowed disabled:text-[#8a9894]"
              disabled={!latestAnswer}
              label="Speak latest"
              text={answerVoiceText(latestAnswer)}
            />
            <span className="text-xs font-medium text-[#60706c]">
              {latestAnswer
                ? `${latestAnswer.mode} | ${latestAnswer.coverage}`
                : "Waiting for chat"}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="max-h-[420px] min-h-[260px] overflow-y-auto border-y border-[#d9e1dd] py-3">
            <div className="grid gap-3">
              {messages.map((message) => (
                <article
                  className={`max-w-[92%] rounded-lg px-4 py-3 ${
                    message.role === "user"
                      ? "ml-auto bg-[#17211f] text-white"
                      : "border border-[#d9e1dd] bg-[#f9fbfa] text-[#243632]"
                  }`}
                  key={message.id}
                >
                  <p className="text-xs font-semibold uppercase opacity-70">
                    {message.role === "user" ? "You" : "Aida"}
                  </p>
                  <p className="mt-2 text-sm leading-6">{message.text}</p>
                  {message.answer ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md bg-[#dff6ee] px-2 py-1 font-semibold text-[#11775f]">
                        {message.answer.confidence}
                      </span>
                      <span className="rounded-md bg-white px-2 py-1 font-semibold text-[#55716a]">
                        {message.answer.coverage}
                      </span>
                    </div>
                  ) : null}
                </article>
              ))}
              {isSending ? (
                <article className="max-w-[92%] rounded-lg border border-[#d9e1dd] bg-[#f9fbfa] px-4 py-3 text-[#243632]">
                  <p className="text-xs font-semibold uppercase text-[#55716a]">
                    Aida
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    Retrieving live open-access evidence.
                  </p>
                </article>
              ) : null}
            </div>
          </div>

          {latestCitedArticles.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {latestCitedArticles.map((article) => (
                <a
                  className="rounded-md border border-[#d9e1dd] bg-[#f9fbfa] px-3 py-2 text-xs text-[#40514d] transition hover:bg-[#eef5f2]"
                  href={article.url}
                  key={article.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="font-semibold text-[#11775f]">
                    {article.id}
                  </span>{" "}
                  {article.title}
                </a>
              ))}
            </div>
          ) : null}

          <form className="mt-4 grid gap-3" onSubmit={submitMessage}>
            <label className="sr-only" htmlFor="aida-chat-input">
              Ask Aida
            </label>
            <textarea
              className="min-h-24 resize-none rounded-md border border-[#c8d2ce] bg-white px-4 py-3 text-sm leading-6 text-[#243632] outline-none transition focus:border-[#0f8f73]"
              id="aida-chat-input"
              maxLength={320}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a research question"
              value={input}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-md bg-[#17211f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#243632] disabled:cursor-not-allowed disabled:bg-[#9aa7a3]"
                disabled={isSending || input.trim().length === 0}
                type="submit"
              >
                {isSending ? "Asking Aida" : "Send"}
              </button>
              <button
                aria-pressed={isListening}
                className="rounded-md border border-[#c8d2ce] bg-white px-4 py-3 text-sm font-semibold text-[#243632] transition hover:bg-[#f2f5f3] disabled:cursor-not-allowed disabled:text-[#8a9894]"
                disabled={!voiceSupported}
                onClick={toggleVoiceInput}
                type="button"
              >
                {isListening ? "Stop voice" : "Voice input"}
              </button>
              <span className="text-xs font-medium text-[#60706c]">
                {voiceStatus}
              </span>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
