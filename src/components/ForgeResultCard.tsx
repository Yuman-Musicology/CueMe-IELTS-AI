"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { parseScript } from "@/lib/parse-script";
import type { Card, Rarity } from "@/types/card";

// ---------------------------------------------------------------------------
// Rarity visual config
// ---------------------------------------------------------------------------

const RARITY: Record<
  Rarity,
  { label: string; badge: string; border: string; glow: string }
> = {
  Common: {
    label: "普通级",
    badge: "bg-[#F0EFED] text-[#999]",
    border: "border-[#E8E4DE]",
    glow: "",
  },
  Rare: {
    label: "稀有级",
    badge: "bg-[#EFF6FF] text-[#3B82F6]",
    border: "border-[#BFDBFE]",
    glow: "",
  },
  Epic: {
    label: "史诗级",
    badge: "bg-[#F5F3FF] text-[#8B5CF6]",
    border: "border-[#C4B5FD]",
    glow: "shadow-[0_0_30px_rgba(139,92,246,0.10)]",
  },
  Legendary: {
    label: "传说级",
    badge: "bg-[#FEF9C3] text-[#A16207]",
    border: "border-transparent",
    glow: "",
  },
};

// ---------------------------------------------------------------------------
// Legendary confetti burst
// ---------------------------------------------------------------------------

function fireLegendaryConfetti() {
  const gold = ["#FACC15", "#FDE68A", "#FEF9C3", "#D4A017", "#B8860B"];

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.55 },
    colors: gold,
    ticks: 120,
    gravity: 0.9,
    scalar: 1.1,
  });

  setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 100,
      origin: { y: 0.45, x: 0.35 },
      colors: gold,
      ticks: 100,
    });
    confetti({
      particleCount: 40,
      spread: 100,
      origin: { y: 0.45, x: 0.65 },
      colors: gold,
      ticks: 100,
    });
  }, 250);
}

// ---------------------------------------------------------------------------
// Legendary shimmer border (CSS @property + conic-gradient)
// ---------------------------------------------------------------------------

function ShimmerBorder() {
  return (
    <div
      className="legendary-shimmer legendary-glow absolute -inset-[2px] rounded-[34px] pointer-events-none"
      style={{
        mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMask:
          "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        maskComposite: "exclude",
        WebkitMaskComposite: "xor",
        padding: "2.5px",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Bookmark icon
// ---------------------------------------------------------------------------

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ForgeResultCard
// ---------------------------------------------------------------------------

interface ForgeResultCardProps {
  card: Card;
}

const CORPUS_STORAGE_KEY = "cueme_user_corpus";
const SCENE_TAGS = ["人物", "地点", "事物", "事件"] as const;

interface LocalCorpusItem {
  id: string;
  title: string;
  cue_card: string;
  script: string;
  scene_tags: string[];
  created_at: string;
}

export default function ForgeResultCard({ card }: ForgeResultCardProps) {
  const [saved, setSaved] = useState(card.saved);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSceneTags, setSelectedSceneTags] = useState<string[]>([]);
  const [toastVisible, setToastVisible] = useState(false);
  const confettiFired = useRef(false);

  const cfg = RARITY[card.rarity];
  const isLegendary = card.rarity === "Legendary";

  useEffect(() => {
    if (isLegendary && !confettiFired.current) {
      confettiFired.current = true;
      const timer = setTimeout(fireLegendaryConfetti, 600);
      return () => clearTimeout(timer);
    }
  }, [isLegendary]);

  function toggleSceneTag(tag: string) {
    setSelectedSceneTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
  }

  function handleSaveClick() {
    if (saved) return;
    setIsModalOpen(true);
  }

  function handleConfirmSave() {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(CORPUS_STORAGE_KEY);
      const existing = raw ? (JSON.parse(raw) as LocalCorpusItem[]) : [];
      const nextItem: LocalCorpusItem = {
        id: card.id,
        title: card.title,
        cue_card: card.cue_card,
        script: card.script,
        scene_tags: selectedSceneTags,
        created_at: new Date().toISOString(),
      };

      const deduped = existing.filter(
        (item) => item.id !== card.id && item.cue_card !== card.cue_card
      );

      localStorage.setItem(
        CORPUS_STORAGE_KEY,
        JSON.stringify([nextItem, ...deduped])
      );

      setSaved(true);
      setIsModalOpen(false);
      setSelectedSceneTags([]);
      setToastVisible(true);
      window.setTimeout(() => setToastVisible(false), 2200);
    } catch (error) {
      console.error("[ForgeResultCard] failed to save local corpus:", error);
    }
  }

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full"
      >
        {/* shimmer border — Legendary only */}
        {isLegendary && <ShimmerBorder />}

        <div
          className={[
            "relative bg-white rounded-[32px] border overflow-hidden",
            cfg.border,
            cfg.glow,
            "transition-shadow duration-500",
          ].join(" ")}
        >
          {/* ── Top section: title + rarity + tags ──────────────────────── */}
          <div className="px-8 pt-8 md:px-10 md:pt-10">
            {/* title row */}
            <div className="mb-4 flex items-start justify-between gap-4">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12, duration: 0.4 }}
                className="text-[22px] font-bold tracking-tight leading-snug text-[#1A1A1A]"
              >
                {card.title}
              </motion.div>

              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.35, type: "spring" }}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold tracking-wider uppercase ${cfg.badge}`}
              >
                {cfg.label}
              </motion.span>
            </div>

            {/* milestone banner */}
            <AnimatePresence>
              {card.milestone && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.4 }}
                  className="overflow-hidden rounded-2xl border border-[#FACC15]/25 bg-gradient-to-r from-[#FACC15]/15 to-[#FDE68A]/15 px-4 py-3 text-sm font-medium text-[#92700C]"
                >
                  解锁传说级语料 —— 你的屠鸭宝刀
                </motion.div>
              )}
            </AnimatePresence>

            {card.applicable_topics.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.35 }}
                className="mb-5"
              >
                <p className="mb-3 text-[12px] font-medium text-[#8F8A84]">
                  你刚刚写的这个故事，可以直接秒杀这 {card.applicable_topics.length} 道雅思题
                </p>
                <div className="flex flex-wrap gap-2">
                  {card.applicable_topics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-[#F5F2ED] px-3 py-1.5 text-xs font-medium text-[#5E5953]"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* tags */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.22, duration: 0.4 }}
              className="mb-2 flex flex-wrap gap-2"
            >
              {card.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#F9F8F6] px-3 py-1 text-xs font-medium text-[#888]"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          </div>

          {/* ── Divider ─────────────────────────────────────────────────── */}
          <div className="mx-8 my-4 h-px bg-[#F0EFED] md:mx-10" />

          {/* ── Script body ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="whitespace-pre-line px-8 text-[15px] leading-[1.9] text-[#444] md:px-10"
          >
            {parseScript(card.script)}
          </motion.div>

          {/* ── Divider ─────────────────────────────────────────────────── */}
          <div className="mx-8 my-6 h-px bg-[#F0EFED] md:mx-10" />

          {/* ── Golden Phrases ──────────────────────────────────────────── */}
          {(card.golden_phrases?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="mb-2 px-8 md:px-10"
            >
              <h3 className="mb-3 text-[11px] font-bold tracking-widest text-[#ADADAD] uppercase">
                高光语料
              </h3>

              <div className="grid gap-2">
                {card.golden_phrases.map((gp, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + i * 0.06, duration: 0.3 }}
                    className="flex items-baseline gap-3 rounded-2xl border border-[#FEF3C7] bg-[#FFFBEB] px-4 py-3"
                  >
                    <span className="shrink-0 text-[13px] font-bold text-[#1A1A1A]">
                      {gp.phrase}
                    </span>
                    <span className="text-[13px] text-[#888]">
                      {gp.explanation}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Footer: Save button ───────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            className="px-8 pb-8 pt-4 md:px-10 md:pb-10"
          >
            <Button
              onClick={handleSaveClick}
              disabled={saved}
              className={[
                "h-[52px] w-full gap-2 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98]",
                saved
                  ? "cursor-not-allowed bg-[#1A1A1A] text-white"
                  : "cursor-pointer bg-[#FACC15] text-[#1A1A1A] shadow-[0_4px_24px_rgba(250,204,21,0.35)] hover:bg-[#EAB308]",
              ].join(" ")}
            >
              <BookmarkIcon filled={saved} />
              {saved ? "已保存" : "保存至我的卡组"}
            </Button>
          </motion.div>
        </div>
      </motion.article>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
            >
              <div className="mb-6">
                <h3 className="mb-2 text-lg font-bold text-[#1A1A1A]">
                  保存至我的卡组
                </h3>
                <p className="text-sm leading-relaxed text-[#7C7873]">
                  请为该语料选择适用的场景标签（可多选）
                </p>
              </div>

              <div className="mb-6 flex flex-wrap gap-3">
                {SCENE_TAGS.map((tag) => {
                  const active = selectedSceneTags.includes(tag);

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleSceneTag(tag)}
                      className={[
                        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-[#1A1A1A] text-white"
                          : "bg-[#F5F2ED] text-[#5E5953] hover:bg-[#ECE7E1]",
                      ].join(" ")}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedSceneTags([]);
                  }}
                  className="flex-1 rounded-2xl border border-[#E7E1D8] bg-white px-4 py-3 text-sm font-semibold text-[#5E5953] transition-colors hover:bg-[#FAF8F5]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="flex-1 rounded-2xl bg-[#FACC15] px-4 py-3 text-sm font-semibold text-[#1A1A1A] transition-colors hover:bg-[#EAB308]"
                >
                  确认保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastVisible && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            已成功保存至本地卡组！
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
