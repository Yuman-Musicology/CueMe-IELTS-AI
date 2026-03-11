"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { parseScript } from "@/lib/parse-script";
import { getSupabase } from "@/lib/supabase/client";
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

export default function ForgeResultCard({ card }: ForgeResultCardProps) {
  const [saved, setSaved] = useState(card.saved);
  const [saving, setSaving] = useState(false);
  const confettiFired = useRef(false);

  const cfg = RARITY[card.rarity];
  const isLegendary = card.rarity === "Legendary";
  const isGuest = card.id.startsWith("guest-");

  useEffect(() => {
    if (isLegendary && !confettiFired.current) {
      confettiFired.current = true;
      const timer = setTimeout(fireLegendaryConfetti, 600);
      return () => clearTimeout(timer);
    }
  }, [isLegendary]);

  async function handleSave() {
    if (isGuest) return;
    setSaving(true);
    const next = !saved;

    const { error } = await getSupabase()
      .from("cards")
      .update({ saved: next })
      .eq("id", card.id);

    if (!error) setSaved(next);
    setSaving(false);
  }

  return (
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
          <div className="flex items-start justify-between gap-4 mb-4">
            <motion.h2
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12, duration: 0.4 }}
              className="text-[22px] font-bold text-[#1A1A1A] tracking-tight leading-snug"
            >
              {card.title}
            </motion.h2>

            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.35, type: "spring" }}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${cfg.badge}`}
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
                className="px-4 py-3 rounded-2xl bg-gradient-to-r from-[#FACC15]/15 to-[#FDE68A]/15 border border-[#FACC15]/25 text-sm font-medium text-[#92700C] overflow-hidden"
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
              <p className="text-[12px] font-medium text-[#8F8A84] mb-3">
                你刚刚写的这个故事，可以直接秒杀这 {card.applicable_topics.length} 道雅思题
              </p>
              <div className="flex flex-wrap gap-2">
                {card.applicable_topics.map((topic) => (
                  <span
                    key={topic}
                    className="px-3 py-1.5 rounded-full bg-[#F5F2ED] text-[#5E5953] text-xs font-medium"
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
            className="flex flex-wrap gap-2 mb-2"
          >
            {card.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full bg-[#F9F8F6] text-[#888] text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </motion.div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <div className="mx-8 md:mx-10 my-4 h-px bg-[#F0EFED]" />

        {/* ── Script body ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="px-8 md:px-10 text-[15px] leading-[1.9] text-[#444] whitespace-pre-line"
        >
          {parseScript(card.script)}
        </motion.div>

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <div className="mx-8 md:mx-10 my-6 h-px bg-[#F0EFED]" />

        {/* ── Golden Phrases ──────────────────────────────────────────── */}
        {(card.golden_phrases?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="px-8 md:px-10 mb-2"
          >
            <h3 className="text-[11px] font-bold text-[#ADADAD] mb-3 tracking-widest uppercase">
              高光语料
            </h3>

            <div className="grid gap-2">
              {card.golden_phrases.map((gp, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.06, duration: 0.3 }}
                  className="flex items-baseline gap-3 px-4 py-3 rounded-2xl bg-[#FFFBEB] border border-[#FEF3C7]"
                >
                  <span className="shrink-0 font-bold text-[13px] text-[#1A1A1A]">
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

        {/* ── Footer: Save button ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="px-8 pb-8 pt-4 md:px-10 md:pb-10"
        >
          <Button
            onClick={handleSave}
            disabled={saving || isGuest}
            className={[
              "w-full h-[52px] rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98] gap-2",
              isGuest
                ? "bg-[#ECEAE6] text-[#BCBAB5] cursor-not-allowed"
                : saved
                  ? "bg-[#1A1A1A] hover:bg-[#333] text-white cursor-pointer"
                  : "bg-[#FACC15] hover:bg-[#EAB308] text-[#1A1A1A] shadow-[0_4px_24px_rgba(250,204,21,0.35)] cursor-pointer",
            ].join(" ")}
          >
            <BookmarkIcon filled={saved} />
            {isGuest
              ? "登录后保存至卡组"
              : saving
                ? "保存中..."
                : saved
                  ? "已保存到卡组"
                  : "保存到卡组"}
          </Button>
        </motion.div>
      </div>
    </motion.article>
  );
}
