"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabase } from "@/lib/supabase/client";

const timelineOptions = ["1个月", "2个月", "3个月", "6个月及以上"];

export default function AboutUPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [score, setScore] = useState("");
  const [timeline, setTimeline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isValid = name.trim() && score && timeline;

  async function handleSubmit() {
    if (!isValid) {
      setError("请填写所有信息后再继续");
      return;
    }

    setError("");
    setSubmitting(true);
    console.log("[AboutU] submitting:", { name, score, timeline });

    if (typeof window !== "undefined") {
      localStorage.setItem("cueme_userName", name.trim());
    }

    try {
      const sb = getSupabase();
      const {
        data: { user },
      } = await sb.auth.getUser();

      if (user) {
        const { error: dbError } = await sb
          .from("profiles")
          .upsert(
            {
              id: user.id,
              nickname: name.trim(),
              target_score: parseFloat(score),
              exam_timeline: timeline,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );

        if (dbError) {
          console.warn("[AboutU] profile upsert failed:", dbError.message);
        } else {
          console.log("[AboutU] profile saved");
        }
      } else {
        console.log("[AboutU] no auth session — skipping profile save");
      }
    } catch (err) {
      console.warn("[AboutU] supabase error, continuing:", err);
    }

    router.push("/forge");
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center px-4 py-8 md:px-6 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[920px] bg-white rounded-[32px] p-8 md:p-10 shadow-sm"
      >
        <h1 className="text-3xl font-bold text-[#1A1A1A] mb-10 tracking-tight md:mb-12">
          About U
        </h1>

        <div className="space-y-10">
          {/* 昵称输入 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="flex flex-col gap-3"
          >
            <label className="text-sm font-semibold text-[#1A1A1A] ml-1">
              怎么称呼你？
            </label>
            <Input
              placeholder="你的名字/昵称..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-14 bg-[#F9F8F6] border border-transparent rounded-2xl px-5 text-base text-[#1A1A1A] placeholder:text-[#C0BDB8] focus-visible:ring-0 focus-visible:bg-[#F6F3EE] focus-visible:border-[#E8E4DE] transition-colors"
            />
          </motion.div>

          {/* 目标分数选择 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="flex flex-col gap-3"
          >
            <label className="text-sm font-semibold text-[#1A1A1A] ml-1">
              你想拿下几分？
            </label>
            <Select value={score} onValueChange={(v) => setScore(v ?? "")}>
              <SelectTrigger className="h-14 w-full bg-[#F9F8F6] border border-transparent rounded-2xl px-5 text-base text-[#1A1A1A] focus:ring-0 focus:bg-[#F6F3EE] focus:border-[#E8E4DE] transition-colors">
                <SelectValue placeholder="请选择" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-[#E8E4DE]">
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="6.5">6.5</SelectItem>
                <SelectItem value="7">7</SelectItem>
                <SelectItem value="7.5">7.5</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>

          {/* 备考时间轴 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="flex flex-col gap-4"
          >
            <label className="text-sm font-semibold text-[#1A1A1A] ml-1">
              还有多久上考场？
            </label>
            <div className="flex flex-wrap gap-3.5">
              {timelineOptions.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setTimeline(time)}
                  className={`px-6 py-3.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    timeline === time
                      ? "bg-[#FACC15] text-[#1A1A1A] shadow-[0_4px_16px_rgba(250,204,21,0.25)]"
                      : "bg-[#F9F8F6] text-[#7C7873] border border-transparent hover:bg-[#F6F3EE]"
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </motion.div>

          {/* 错误提示 */}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-500 font-medium ml-1"
            >
              {error}
            </motion.p>
          )}

          {/* 提交按钮 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
          >
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className={[
                "w-full h-14 mt-2 text-lg font-bold rounded-full transition-all active:scale-[0.98]",
                isValid
                  ? "bg-[#FACC15] hover:bg-[#EAB308] text-[#1A1A1A] shadow-[0_4px_20px_rgba(250,204,21,0.3)]"
                  : "bg-[#E8E4DE] text-[#8D8A86] cursor-not-allowed shadow-none",
              ].join(" ")}
            >
              {submitting ? "正在启动..." : "开启 CueMe"}
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
