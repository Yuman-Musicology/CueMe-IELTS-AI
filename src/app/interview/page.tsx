"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, LoaderCircle, Mic } from "lucide-react";

type ArenaStatus = "idle" | "recording" | "processing";
type Difficulty = "简单" | "进阶" | "地狱";
type InterviewPhase =
  | "idle"
  | "warmup"
  | "cuecard"
  | "prep"
  | "speaking"
  | "feedback";

interface Examiner {
  id: string;
  name: string;
  difficulty: Difficulty;
  persona: string;
  avatar: string;
}

interface ExaminerPayload {
  id: string;
  name: string;
  difficulty: Difficulty;
  persona: string;
}

interface ChatMessage {
  id: string;
  role: "examiner" | "user";
  type: "text";
  content?: string;
  feedback?: string;
}

interface ScoreDetail {
  score: number;
  reason: string;
}

interface FeedbackResult {
  scores: {
    FC: ScoreDetail;
    LR: ScoreDetail;
    GRA: ScoreDetail;
    P: ScoreDetail;
  };
  overall: number;
  highlights: string[];
  suggestions: Array<{
    original: string;
    improved: string;
    rule: string;
  }>;
  examinerClosing: string;
}

interface ReviewResultCardPayload {
  topic: string;
  transcript: string;
  scores: FeedbackResult["scores"];
  overallScore: number;
  suggestions: FeedbackResult["suggestions"];
  highlights: string[];
  examinerClosing: string;
}

interface StoredForgeCard {
  title?: string;
  tags?: string[];
  applicable_topics?: string[];
  user_story?: string;
}

const EXAMINERS: Examiner[] = [
  {
    id: "sarah",
    name: "Sarah",
    difficulty: "简单",
    persona: "善良的黑人姐姐，总是微笑鼓励",
    avatar: "/avatars/Sarah.jpg",
  },
  {
    id: "raj",
    name: "Raj",
    difficulty: "简单",
    persona: "咖喱味印度小哥，语速快但人很好",
    avatar: "/avatars/Raj.jpg",
  },
  {
    id: "arthur",
    name: "Arthur",
    difficulty: "进阶",
    persona: "慈祥的英国爷爷，标准RP口音",
    avatar: "/avatars/Arthur.jpg",
  },
  {
    id: "kevin",
    name: "Kevin",
    difficulty: "进阶",
    persona: "笑面虎亚裔，表面笑嘻嘻打分极严",
    avatar: "/avatars/Kevin.jpg",
  },
  {
    id: "jessica",
    name: "Jessica",
    difficulty: "地狱",
    persona: "Mean白女，毫无耐心，极具压迫感",
    avatar: "/avatars/Jessica.jpg",
  },
  {
    id: "david",
    name: "David",
    difficulty: "地狱",
    persona: "高冷白男，面无表情，一针见血",
    avatar: "/avatars/David.jpg",
  },
];

const STATUS_TEXT: Record<ArenaStatus, string> = {
  idle: "点击开始模拟",
  recording: "正在聆听... 点击结束",
  processing: "考官正在打分...",
};

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  简单: "bg-emerald-50 text-emerald-600",
  进阶: "bg-amber-50 text-amber-600",
  地狱: "bg-red-50 text-red-500",
};

const PHASE_LABELS: Record<InterviewPhase, string> = {
  idle: "Part 1: Introduction",
  warmup: "Part 1: Introduction",
  cuecard: "Part 2: Cue Card",
  prep: "Part 2: Preparation",
  speaking: "Part 2: Long Turn",
  feedback: "Part 2: Feedback",
};

const WARMUP_TARGET_TURNS = 2;
const PREP_DURATION = 60;
const SPEAKING_DURATION = 120;

export default function InterviewPage() {
  const [status, setStatus] = useState<ArenaStatus>("idle");
  const [phase, setPhase] = useState<InterviewPhase>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [errorText, setErrorText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<FeedbackResult | null>(null);
  const [userName, setUserName] = useState("屠鸭战士");
  const [latestTranscript, setLatestTranscript] = useState("");
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [warmupTurns, setWarmupTurns] = useState(0);
  const [cueCardText, setCueCardText] = useState("");
  const [prepSecondsLeft, setPrepSecondsLeft] = useState(PREP_DURATION);
  const [speakingSecondsLeft, setSpeakingSecondsLeft] = useState(SPEAKING_DURATION);
  const [selectedExaminer, setSelectedExaminer] = useState<Examiner | null>(
    null
  );
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartedAtRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackUrlRef = useRef<string | null>(null);

  const groupedExaminers = useMemo(
    () => ({
      简单: EXAMINERS.filter((item) => item.difficulty === "简单"),
      进阶: EXAMINERS.filter((item) => item.difficulty === "进阶"),
      地狱: EXAMINERS.filter((item) => item.difficulty === "地狱"),
    }),
    []
  );

  useEffect(() => {
    return () => {
      stopPlayback();
      mediaRecorderRef.current?.stream
        .getTracks()
        .forEach((track) => track.stop());
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatHistory]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUserName(localStorage.getItem("cueme_userName") || "屠鸭战士");
  }, []);

  useEffect(() => {
    if (phase !== "speaking" || status !== "recording") return;

    const timer = window.setInterval(() => {
      setSpeakingSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          stopRecording();
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, status]);

  function toExaminerPayload(examiner: Examiner): ExaminerPayload {
    return {
      id: examiner.id,
      name: examiner.name,
      difficulty: examiner.difficulty,
      persona: examiner.persona,
    };
  }

  function stopPlayback() {
    playbackAudioRef.current?.pause();
    playbackAudioRef.current = null;
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
  }

  const playExaminerAudio = useCallback(
    async (text: string, examinerId: string) => {
      if (typeof window === "undefined") return;

      stopPlayback();

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          examinerId,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "TTS request failed");
      }

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      playbackUrlRef.current = audioUrl;
      playbackAudioRef.current = audio;

      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        if (playbackUrlRef.current) {
          URL.revokeObjectURL(playbackUrlRef.current);
          playbackUrlRef.current = null;
        }
        playbackAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        if (playbackUrlRef.current) {
          URL.revokeObjectURL(playbackUrlRef.current);
          playbackUrlRef.current = null;
        }
        playbackAudioRef.current = null;
      };

      await audio.play();
    },
    []
  );

  function appendMessage(message: ChatMessage) {
    setChatHistory((prev) => [...prev, message]);
  }

  function formatContextMessages(messages: ChatMessage[]) {
    return messages
      .filter((message) => message.content?.trim())
      .slice(-6)
      .map((message) => ({
        role: message.role,
        content: message.content!.trim(),
      }));
  }

  function getForgeMaterialKeywords() {
    if (typeof window === "undefined") return ["travel", "memory", "person"];

    try {
      const raw = localStorage.getItem("cueme_latestForgeCard");
      if (!raw) return ["travel", "memory", "person"];

      const stored = JSON.parse(raw) as StoredForgeCard;
      const keywords = [
        stored.title,
        ...(stored.tags ?? []),
        ...(stored.applicable_topics ?? []),
      ]
        .filter((item): item is string => Boolean(item?.trim()))
        .map((item) => item.trim());

      if (stored.user_story?.trim()) {
        keywords.push(stored.user_story.trim().slice(0, 80));
      }

      return Array.from(new Set(keywords)).slice(0, 8);
    } catch {
      return ["travel", "memory", "person"];
    }
  }

  async function requestInterview(payload: {
    examiner: Examiner;
    phase: InterviewPhase;
    task?: string;
    audioBase64?: string;
    audioMimeType?: string;
    materialKeywords?: string[];
    contextMessages?: Array<{
      role: "examiner" | "user";
      content: string;
    }>;
  }) {
    const res = await fetch("/api/interview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        examiner: toExaminerPayload(payload.examiner),
        phase: payload.phase,
        task: payload.task,
        audioBase64: payload.audioBase64,
        audioMimeType: payload.audioMimeType,
        materialKeywords: payload.materialKeywords,
        contextMessages: payload.contextMessages,
      }),
    });

    const data = (await res.json()) as {
      error?: string;
      transcript?: string;
      feedback?: string;
      reply?: string;
      scores?: FeedbackResult["scores"];
      overall?: number;
      highlights?: string[];
      suggestions?: FeedbackResult["suggestions"];
      examinerClosing?: string;
    };

    if (!res.ok) {
      throw new Error(data.error || "Interview request failed");
    }

    return data;
  }

  async function startInterview(examiner: Examiner) {
    setErrorText("");
    setStatus("processing");
    setPhase("warmup");
    setFeedbackResult(null);
    setLatestTranscript("");
    setIsSavingReview(false);
    setReviewSaved(false);
    setWarmupTurns(0);
    setCueCardText("");
    setPrepSecondsLeft(PREP_DURATION);
    setSpeakingSecondsLeft(SPEAKING_DURATION);
    setChatHistory([]);

    try {
      const data = await requestInterview({
        examiner,
        phase: "warmup",
        task: "Part 1: Greeting and Name/Job question",
      });

      const openingLine =
        data.reply?.trim() ||
        `Hello, I'm ${examiner.name}. Could you introduce yourself and tell me what you do?`;

      appendMessage({
        id: `warmup-open-${Date.now()}`,
        role: "examiner",
        type: "text",
        content: openingLine,
      });

      try {
        await playExaminerAudio(openingLine, examiner.id);
      } catch (error) {
        console.error("[Interview] opening TTS error:", error);
      }
    } catch (error) {
      console.error("[Interview] failed to start:", error);
      setErrorText("开场失败，请稍后再试");
      setPhase("idle");
    } finally {
      setStatus("idle");
    }
  }

  async function beginCueCardFlow(examiner: Examiner) {
    setPhase("cuecard");
    setStatus("processing");
    setErrorText("");

    try {
      const data = await requestInterview({
        examiner,
        phase: "cuecard",
        materialKeywords: getForgeMaterialKeywords(),
        task: "根据这些语料随机出一道能串联这些内容的雅思 Part 2 题目。只返回题目文本。",
        contextMessages: formatContextMessages(chatHistory),
      });

      const question =
        data.reply?.trim() ||
        "Describe an experience from your life that you can talk about in detail.";

      setCueCardText(question);
      appendMessage({
        id: `cuecard-${Date.now()}`,
        role: "examiner",
        type: "text",
        content: `Here is your Part 2 topic: ${question}`,
      });

      try {
        await playExaminerAudio(`Here is your Part 2 topic. ${question}`, examiner.id);
      } catch (error) {
        console.error("[Interview] cue card TTS error:", error);
      }

      setPhase("prep");
      setPrepSecondsLeft(PREP_DURATION);
    } catch (error) {
      console.error("[Interview] cue card error:", error);
      setErrorText("Cue Card 抽取失败，请稍后重试");
      setPhase("warmup");
    } finally {
      setStatus("idle");
    }
  }

  const enterSpeakingPhase = useCallback(async () => {
    if (!selectedExaminer) return;

    setPhase("speaking");
    setSpeakingSecondsLeft(SPEAKING_DURATION);

    const prompt = "All right. Your preparation time is over. Please start speaking now.";

    appendMessage({
      id: `speaking-start-${Date.now()}`,
      role: "examiner",
      type: "text",
      content: prompt,
    });

    try {
      await playExaminerAudio(prompt, selectedExaminer.id);
    } catch (error) {
      console.error("[Interview] speaking prompt TTS error:", error);
    }
  }, [playExaminerAudio, selectedExaminer]);

  useEffect(() => {
    if (phase !== "prep") return;

    const timer = window.setInterval(() => {
      setPrepSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          void enterSpeakingPhase();
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [enterSpeakingPhase, phase]);

  async function blobToBase64(blob: Blob) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Failed to convert audio blob"));
          return;
        }

        resolve(result.split(",")[1] ?? "");
      };

      reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
      reader.readAsDataURL(blob);
    });
  }

  async function sendAudioToExaminer(
    blob: Blob,
    examiner: Examiner,
    seconds: number,
    activePhase: InterviewPhase
  ) {
    const audioBase64 = await blobToBase64(blob);
    const data = await requestInterview({
      examiner,
      phase: activePhase,
      task:
        activePhase === "warmup"
          ? "继续 Part 1，保持简短自然，并提出下一个基础问题。"
          : "这是一段 Part 2 长段陈述，请做更有深度的点评。",
      audioBase64,
      audioMimeType: blob.type || "audio/webm",
      contextMessages: formatContextMessages(chatHistory),
    });

    if (activePhase === "warmup") {
      const replyText =
        data.reply?.trim() || "Could you answer that one more time, please?";

      appendMessage({
        id: `user-transcript-${Date.now()}`,
        role: "user",
        type: "text",
        content:
          data.transcript?.trim() || `[语音转写失败，录音时长约 ${seconds} 秒]`,
      });

      appendMessage({
        id: `examiner-reply-${Date.now() + 1}`,
        role: "examiner",
        type: "text",
        content: replyText,
        feedback: data.feedback?.trim() || "这次回答信息较少，可以补充更多细节。",
      });

      try {
        await playExaminerAudio(replyText, examiner.id);
      } catch (error) {
        console.error("[Interview] ElevenLabs playback error:", error);
        setErrorText("考官语音播放失败，但文字回复已送达");
        setIsSpeaking(false);
      }

      const nextTurns = warmupTurns + 1;
      setWarmupTurns(nextTurns);
      if (nextTurns >= WARMUP_TARGET_TURNS) {
        await beginCueCardFlow(examiner);
      }
      return;
    }

    if (activePhase === "speaking") {
      setLatestTranscript(data.transcript?.trim() || "");
      const result: FeedbackResult = {
        scores: data.scores ?? {
          FC: { score: 5.5, reason: "流利度一般，偶尔停顿较多。" },
          LR: { score: 5.5, reason: "词汇使用较基础，亮点不多。" },
          GRA: { score: 5.5, reason: "句式变化有限，准确性一般。" },
          P: { score: 5.5, reason: "表达基本清晰，但节奏和重音还能更自然。" },
        },
        overall: typeof data.overall === "number" ? data.overall : 5.5,
        highlights: Array.isArray(data.highlights) ? data.highlights : [],
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        examinerClosing:
          data.examinerClosing?.trim() ||
          "Thank you. That's enough for this round.",
      };

      setFeedbackResult(result);
      setPhase("feedback");

      try {
        await playExaminerAudio(result.examinerClosing, examiner.id);
      } catch (error) {
        console.error("[Interview] feedback TTS error:", error);
        setIsSpeaking(false);
      }
    }
  }

  function chooseExaminer(examiner: Examiner) {
    stopPlayback();
    setIsSpeaking(false);
    setSelectedExaminer(examiner);
    setChatHistory([]);
    setErrorText("");
    setFeedbackResult(null);
    setLatestTranscript("");
    setIsSavingReview(false);
    setReviewSaved(false);
    setCueCardText("");
    setWarmupTurns(0);
    setPrepSecondsLeft(PREP_DURATION);
    setSpeakingSecondsLeft(SPEAKING_DURATION);
    setPhase("idle");
    setStatus("idle");
  }

  function resetExaminer() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    stopPlayback();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    audioChunksRef.current = [];
    recordStartedAtRef.current = null;
    setSelectedExaminer(null);
    setChatHistory([]);
    setFeedbackResult(null);
    setLatestTranscript("");
    setIsSavingReview(false);
    setReviewSaved(false);
    setCueCardText("");
    setWarmupTurns(0);
    setPrepSecondsLeft(PREP_DURATION);
    setSpeakingSecondsLeft(SPEAKING_DURATION);
    setPhase("idle");
    setStatus("idle");
    setIsSpeaking(false);
    setErrorText("");
  }

  async function restartInterview() {
    if (!selectedExaminer) return;

    stopPlayback();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    audioChunksRef.current = [];
    recordStartedAtRef.current = null;
    setAudioBlob(null);
    setFeedbackResult(null);
    setLatestTranscript("");
    setIsSavingReview(false);
    setReviewSaved(false);
    setChatHistory([]);
    setCueCardText("");
    setWarmupTurns(0);
    setPrepSecondsLeft(PREP_DURATION);
    setSpeakingSecondsLeft(SPEAKING_DURATION);
    setIsSpeaking(false);
    setPhase("idle");
    setStatus("idle");
    setErrorText("");

    await startInterview(selectedExaminer);
  }

  async function handleSaveToReviewSet() {
    if (!selectedExaminer || !feedbackResult || reviewSaved || isSavingReview) return;

    setIsSavingReview(true);
    setErrorText("");

    try {
      const resultCard: ReviewResultCardPayload = {
        topic: cueCardText || "Untitled Part 2 Topic",
        transcript: latestTranscript,
        scores: feedbackResult.scores,
        overallScore: feedbackResult.overall,
        suggestions: feedbackResult.suggestions,
        highlights: feedbackResult.highlights,
        examinerClosing: feedbackResult.examinerClosing,
      };

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userName,
          examinerName: selectedExaminer.name,
          resultCard,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || data.code || `Save failed (${res.status})`);
      }

      setReviewSaved(true);
    } catch (error) {
      console.error("[Interview] review save failed:", error);
      setErrorText(error instanceof Error ? error.message : "保存失败，请稍后再试");
    } finally {
      setIsSavingReview(false);
    }
  }

  async function startRecording() {
    try {
      setErrorText("");
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setStatus("processing");
        const activePhase = phase;

        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        setAudioBlob(blob);
        console.log("录音完成，文件大小:", blob.size);

        const durationMs = Date.now() - (recordStartedAtRef.current ?? Date.now());
        const seconds = Math.max(1, Math.round(durationMs / 1000));

        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordStartedAtRef.current = null;

        if (!selectedExaminer) {
          setStatus("idle");
          return;
        }

        try {
          await sendAudioToExaminer(blob, selectedExaminer, seconds, activePhase);
          setStatus("idle");
        } catch (error) {
          console.error("[Interview] AI examiner error:", error);
          setErrorText("考官暂时没有回应，请稍后再试");
          setStatus("idle");
        }
      };

      recorder.start();
      setStatus("recording");
    } catch (error) {
      console.error("[Interview] microphone error:", error);
      setErrorText("麦克风权限获取失败，请检查浏览器设置");
      setStatus("idle");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function handleMicToggle() {
    if (!selectedExaminer) return;

    if (phase === "idle") {
      void startInterview(selectedExaminer);
      return;
    }

    if (phase === "prep" || phase === "cuecard" || phase === "feedback") return;
    if (status === "processing") return;

    if (status === "recording") {
      stopRecording();
      return;
    }

    void startRecording();
  }

  const isRecording = status === "recording";
  const isProcessing = status === "processing";
  const isMicLocked =
    isProcessing || phase === "cuecard" || phase === "prep" || phase === "feedback";

  const phaseHint = {
    idle: "点击开始模拟，进入 Part 1 开场问答",
    warmup: "Part 1 进行中，回答考官的基础问题",
    cuecard: "考官正在根据你的语料抽取 Part 2 题目",
    prep: "60 秒准备中，麦克风暂时锁定",
    speaking: "开始你的 2 分钟陈述",
    feedback: "本轮结束，查看点评或更换考官重新来一轮",
  }[phase];

  const examinerStatus = isSpeaking
    ? "正在说话..."
    : phase === "prep"
      ? "正在等待你思考..."
      : phase === "cuecard"
        ? "正在整理题卡..."
        : "正在注视着你...";

  const showFeedbackCard = phase === "feedback" && feedbackResult;

  if (!selectedExaminer) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] px-4 py-10 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-10"
          >
            <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">
              选择你的考官
            </h1>
          </motion.div>

          <div className="space-y-10">
            {(["简单", "进阶", "地狱"] as Difficulty[]).map((difficulty) => (
              <section key={difficulty}>
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="text-lg font-bold text-[#1A1A1A]">
                    {difficulty}
                  </h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${DIFFICULTY_STYLES[difficulty]}`}
                  >
                    {difficulty}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groupedExaminers[difficulty].map((examiner) => (
                    <button
                      key={examiner.id}
                      type="button"
                      onClick={() => chooseExaminer(examiner)}
                      className="rounded-[28px] bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="sr-only">{examiner.name}</div>
                      <div className="mb-4 flex items-center justify-between">
                        <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-[#F5F2ED]">
                          <Image
                            src={examiner.avatar}
                            alt={examiner.name}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${DIFFICULTY_STYLES[examiner.difficulty]}`}
                        >
                          {examiner.difficulty}
                        </span>
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-[#1A1A1A]">
                        {examiner.name}
                      </h3>
                      <p className="text-sm leading-relaxed text-[#7C7873]">
                        {examiner.persona}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] px-4 py-8 md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] bg-white shadow-sm"
      >
        <header className="border-b border-[#F0EFED] px-6 py-5 md:px-8">
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-[#F7F5F2] px-3 py-1 text-xs font-semibold text-[#6F6962]">
              {PHASE_LABELS[phase]}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${DIFFICULTY_STYLES[selectedExaminer.difficulty]}`}
            >
              {selectedExaminer.difficulty}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={resetExaminer}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F5F2] text-[#4D4943] transition-colors hover:bg-[#EFEAE4]"
              aria-label="更换考官"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="relative h-11 w-11 overflow-hidden rounded-full ring-2 ring-[#F5F2ED]">
              <Image
                src={selectedExaminer.avatar}
                alt={selectedExaminer.name}
                fill
                className="object-cover"
                sizes="44px"
              />
            </div>

            <div>
              <h1 className="text-lg font-bold text-[#1A1A1A]">
                {selectedExaminer.name}
              </h1>
              <p className="text-sm text-[#9A958E]">{examinerStatus}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
          {showFeedbackCard ? (
            <FeedbackCard
              result={feedbackResult}
              cueCardText={cueCardText}
              examiner={selectedExaminer}
            />
          ) : (
            <>
              {cueCardText && (
                <div className="mb-6 rounded-[24px] border border-[#F2EFEA] bg-[#FCFBF9] p-5">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#B4AEA7]">
                    Cue Card
                  </p>
                  <p className="text-[15px] leading-relaxed text-[#1A1A1A]">
                    {cueCardText}
                  </p>
                </div>
              )}

              <div className="space-y-5">
                {chatHistory.map((message) => {
                  const isExaminer = message.role === "examiner";

                  return (
                    <div
                      key={message.id}
                      className={[
                        "flex w-full gap-3",
                        isExaminer ? "justify-start" : "justify-end",
                      ].join(" ")}
                    >
                      {isExaminer && (
                        <div className="relative mt-1 h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-[#F5F2ED]">
                          <Image
                            src={selectedExaminer.avatar}
                            alt={selectedExaminer.name}
                            fill
                            className="object-cover"
                            sizes="36px"
                          />
                        </div>
                      )}

                      <div
                        className={[
                          "max-w-[75%] rounded-[22px] px-4 py-3",
                          isExaminer
                            ? "bg-[#FFFFFF] text-[#1A1A1A] shadow-sm border border-[#F2F0EC]"
                            : "bg-[#1A1A1A] text-white",
                        ].join(" ")}
                      >
                        <div className="space-y-3">
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          {isExaminer && message.feedback && (
                            <div className="rounded-2xl bg-[#F7F5F2] px-3 py-2 text-xs leading-relaxed text-[#7C7873]">
                              点评：{message.feedback}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            </>
          )}
        </div>

        <div className="border-t border-[#F0EFED] px-6 py-6 md:px-8">
          {showFeedbackCard ? (
            <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
              <div>
                <p className="text-sm font-medium text-[#7C7873]">
                  这一轮评分已经生成，可以立刻再练一次。
                </p>
                {reviewSaved && (
                  <p className="mt-1 text-xs font-medium text-emerald-600">
                    已保存到错题集
                  </p>
                )}
              </div>
              <div className="flex w-full gap-3 md:w-auto">
                <button
                  type="button"
                  onClick={() => void restartInterview()}
                  className="flex-1 rounded-2xl bg-[#1A1A1A] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2A2A2A] md:flex-none"
                >
                  再练一次
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveToReviewSet()}
                  disabled={reviewSaved || isSavingReview}
                  className={[
                    "flex-1 rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors md:flex-none",
                    reviewSaved || isSavingReview
                      ? "cursor-not-allowed border-[#E8E2DA] bg-[#F5F2ED] text-[#9B948C]"
                      : "border-[#E5DFD7] bg-white text-[#1A1A1A] hover:bg-[#FAF8F5]",
                  ].join(" ")}
                >
                  {reviewSaved
                    ? "✅ 已同步至云端"
                    : isSavingReview
                      ? "同步中..."
                      : "保存到错题集"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {(phase === "prep" || phase === "speaking") && (
                <TimerRing
                  secondsLeft={phase === "prep" ? prepSecondsLeft : speakingSecondsLeft}
                  totalSeconds={phase === "prep" ? PREP_DURATION : SPEAKING_DURATION}
                  label={phase === "prep" ? "准备时间" : "陈述时间"}
                />
              )}

              <p className="text-sm font-medium text-[#7C7873]">
                {isProcessing ? STATUS_TEXT.processing : phaseHint}
              </p>

              <motion.button
                type="button"
                onClick={handleMicToggle}
                whileTap={!isProcessing ? { scale: 0.98 } : undefined}
                animate={
                  isRecording
                    ? {
                        boxShadow: [
                          "0 0 0 0 rgba(239,68,68,0.22)",
                          "0 0 0 18px rgba(239,68,68,0.08)",
                          "0 0 0 0 rgba(239,68,68,0.22)",
                        ],
                        scale: [1, 1.03, 1],
                      }
                    : {
                        boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
                        scale: 1,
                      }
                }
                transition={
                  isRecording
                    ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.2 }
                }
                disabled={isMicLocked}
                className={[
                  "relative flex h-18 w-18 items-center justify-center rounded-full transition-colors size-[72px]",
                  isRecording
                    ? "bg-red-500 text-white animate-pulse"
                    : isMicLocked
                      ? "bg-[#D9D5CF] text-[#8E8881] cursor-not-allowed"
                      : "bg-[#1A1A1A] text-white hover:bg-[#2A2A2A]",
                ].join(" ")}
                aria-label={
                  phase === "idle"
                    ? "开始模拟"
                    : isRecording
                      ? "停止录音"
                      : isMicLocked
                        ? "暂不可用"
                        : "开始录音"
                }
              >
                {isRecording && (
                  <span className="absolute inset-0 rounded-full border border-red-300 opacity-70" />
                )}
                {isProcessing ? (
                  <LoaderCircle className="h-7 w-7 animate-spin" />
                ) : (
                  <Mic className="h-7 w-7" strokeWidth={1.8} />
                )}
              </motion.button>

              <p className="text-xs text-[#AAA49D]">
                {phase === "idle"
                  ? "点击麦克风开始整场模拟"
                  : phase === "warmup"
                    ? `Part 1 回合 ${Math.min(warmupTurns + 1, WARMUP_TARGET_TURNS)}/${WARMUP_TARGET_TURNS}`
                    : phase === "prep"
                      ? "准备阶段不可录音"
                      : phase === "speaking"
                        ? "麦克风已解锁，开始你的 2 分钟陈述"
                        : "本轮已结束"}
              </p>

              {audioBlob && (
                <p className="text-xs text-[#9A958E]">
                  最近一次录音大小：{Math.max(1, Math.round(audioBlob.size / 1024))}
                  KB
                </p>
              )}
              {errorText && (
                <p className="text-sm font-medium text-red-500">{errorText}</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function TimerRing({
  secondsLeft,
  totalSeconds,
  label,
}: {
  secondsLeft: number;
  totalSeconds: number;
  label: string;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  const offset = circumference * (1 - progress);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="relative flex h-[92px] w-[92px] items-center justify-center">
      <svg className="h-[92px] w-[92px] -rotate-90" viewBox="0 0 92 92">
        <circle
          cx="46"
          cy="46"
          r={radius}
          stroke="#EEEAE4"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="46"
          cy="46"
          r={radius}
          stroke="#FACC15"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[11px] font-semibold tracking-wide text-[#A49E96]">
          {label}
        </span>
        <span className="text-sm font-bold text-[#1A1A1A]">
          {minutes}:{String(seconds).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

function FeedbackCard({
  result,
  cueCardText,
  examiner,
}: {
  result: FeedbackResult;
  cueCardText: string;
  examiner: Examiner;
}) {
  const scoreLabels: Array<{
    key: keyof FeedbackResult["scores"];
    title: string;
  }> = [
    { key: "FC", title: "Fluency & Coherence" },
    { key: "LR", title: "Lexical Resource" },
    { key: "GRA", title: "Grammar Range & Accuracy" },
    { key: "P", title: "Pronunciation" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl rounded-[28px] bg-[#FCFBF9] p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-6 border-b border-[#EEE7DF] pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#B4AEA7]">
            Overall Band
          </p>
          <div className="text-[54px] font-bold leading-none text-[#1A1A1A]">
            {result.overall.toFixed(1)}
          </div>
          {cueCardText && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#7C7873]">
              本轮题目：{cueCardText}
            </p>
          )}
        </div>

        {result.highlights.length > 0 && (
          <div className="rounded-[24px] bg-white px-5 py-4 shadow-sm">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#B4AEA7]">
              Highlights
            </p>
            <div className="space-y-2">
              {result.highlights.map((highlight) => (
                <p key={highlight} className="text-sm text-[#1A1A1A]">
                  {highlight}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {scoreLabels.map(({ key, title }) => (
          <div
            key={key}
            className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#F0E9E1]"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1A1A1A]">{title}</p>
              <span className="rounded-full bg-[#FACC15]/15 px-3 py-1 text-sm font-bold text-[#A16207]">
                {result.scores[key].score.toFixed(1)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[#716B64]">
              {result.scores[key].reason}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#F0E9E1]">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#B4AEA7]">
          高分重构
        </p>
        <div className="space-y-4">
          {result.suggestions.length > 0 ? (
            result.suggestions.map((item, index) => (
              <div
                key={`${item.original}-${index}`}
                className="rounded-[20px] bg-[#FCFBF9] p-4"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[18px] bg-red-50 px-4 py-3">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-red-400">
                      Original
                    </p>
                    <p className="text-sm leading-relaxed text-red-700">
                      {item.original}
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-emerald-50 px-4 py-3">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-500">
                      Band 8 Upgrade
                    </p>
                    <p className="text-sm leading-relaxed text-emerald-700">
                      {item.improved}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[#8A837B]">
                  {item.rule}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-[#7C7873]">
              本轮暂未提取到明确改写项，建议再练一次获取更完整的样本。
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-start gap-4 rounded-[24px] bg-[#1A1A1A] px-5 py-5 text-white">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-white/15">
          <Image
            src={examiner.avatar}
            alt={examiner.name}
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">{examiner.name}</p>
          <p className="text-sm leading-relaxed text-white/80">
            {result.examinerClosing}
          </p>
        </div>
      </div>
    </div>
  );
}
