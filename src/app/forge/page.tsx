"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase/client";
import ForgeResultCard from "@/components/ForgeResultCard";
import type { Card } from "@/types/card";

// ---------------------------------------------------------------------------
// Forge page
// ---------------------------------------------------------------------------

export default function ForgePage() {
  const loadingMessages = [
    "给你找个好讲的题…",
    "正在抽一张 cue card…",
    "考官正在想题…",
  ];
  const [userName, setUserName] = useState("");
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("正在抽一张 cue card…");
  const [error, setError] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const canForge = story.trim().length >= 10;

  useEffect(() => {
    setUserName(localStorage.getItem("cueme_userName") || "屠鸭战士");
  }, []);

  async function handleForge() {
    if (!canForge) return;

    setError("");
    setLoadingText(
      loadingMessages[Math.floor(Math.random() * loadingMessages.length)]
    );
    setLoading(true);
    setCard(null);

    try {
      let token = "";
      try {
        const sb = getSupabase();
        const {
          data: { session },
        } = await sb.auth.getSession();
        token = session?.access_token ?? "";
      } catch {
        // Supabase not configured — continue without auth for dev
      }

      const res = await fetch("/api/forge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_story: story,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      setCard(data.card);
      if (typeof window !== "undefined") {
        localStorage.setItem("cueme_latestForgeCard", JSON.stringify(data.card));
      }

      setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED]">
      <div className="w-full max-w-4xl mx-auto px-4 py-14 md:px-6 md:py-24">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12"
        >
          <h1 className="text-[32px] font-bold text-[#1A1A1A] tracking-tight mb-3">
            Hi, {userName}
          </h1>
          <p className="text-[#999] text-[15px] leading-relaxed">
            你的生活里一定有很多故事——今天想练哪一个？
          </p>
        </motion.div>

        {/* ── Input card ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-4xl mx-auto bg-white rounded-[32px] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-12"
        >
          <div className="space-y-8">
            {/* User story */}
            <div className="flex flex-col gap-4">
              <label className="text-[13px] font-semibold text-[#1A1A1A] ml-0.5 tracking-wide">
                你的故事
              </label>
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder={`例如：今年初我去了挪威的特罗姆瑟看极光。那天晚上气温特别低，我们在雪地里等了很久...\n\n（用中文或英文，随便写几句你的真实经历就好。细节越多，锻造出的独白越自然）`}
                rows={9}
                className="w-full rounded-2xl bg-[#F9F8F6] border-transparent px-5 py-4 text-[15px] text-[#1A1A1A] placeholder:text-[#C8C5C0] placeholder:leading-relaxed resize-none focus:outline-none focus:bg-[#F5F3F0] transition-colors leading-[1.75]"
              />
              <div className="flex items-center justify-between ml-0.5">
                <p className="text-[12px] text-[#D0CDC8]">
                  {story.trim().length < 10
                    ? `至少 10 个字符 (${story.trim().length}/10)`
                    : `${story.trim().length} 字符`}
                </p>
                <p className="text-[12px] text-[#B9B5AF]">
                  系统会自动帮你串联可复用题目
                </p>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-5 py-3.5 rounded-2xl bg-red-50 text-[13px] text-red-500 font-medium"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Forge button */}
            <Button
              onClick={handleForge}
              disabled={!canForge || loading}
              className={[
                "w-full h-[52px] text-[15px] font-bold rounded-2xl transition-all duration-200 active:scale-[0.98] cursor-pointer",
                canForge && !loading
                  ? "bg-[#1A1A1A] hover:bg-[#333] text-white shadow-[0_4px_16px_rgb(0,0,0,0.10)]"
                  : "bg-[#ECEAE6] text-[#BCBAB5] cursor-not-allowed shadow-none",
              ].join(" ")}
            >
              {loading ? <ForgeSpinner text={loadingText} /> : "Cue 一下"}
            </Button>
          </div>
        </motion.div>

        {/* ── Result area ─────────────────────────────────────────────── */}
        <div ref={resultRef} className="w-full max-w-4xl mx-auto">
          <AnimatePresence>
            {card && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full"
              >
                <ForgeResultCard card={card} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading spinner
// ---------------------------------------------------------------------------

function ForgeSpinner({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg className="animate-spin h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none">
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {text}
    </span>
  );
}
