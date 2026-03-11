"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

const CORPUS_STORAGE_KEY = "cueme_user_corpus";
const SCRIPT_PREVIEW_LENGTH = 220;

interface DeckItem {
  id: string;
  title: string;
  cue_card: string;
  script: string;
  scene_tags: string[];
  created_at: string;
}

function readCorpus(): DeckItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(CORPUS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is DeckItem =>
          Boolean(
            item &&
              typeof item === "object" &&
              "id" in item &&
              "cue_card" in item &&
              "script" in item
          )
      )
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      });
  } catch (error) {
    console.warn("[Deck] failed to read local corpus:", error);
    return [];
  }
}

function writeCorpus(items: DeckItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CORPUS_STORAGE_KEY, JSON.stringify(items));
}

export default function DeckPage() {
  const [cards, setCards] = useState<DeckItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCards(readCorpus());
      setHydrated(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function handleDelete(id: string) {
    const next = cards.filter((item) => item.id !== id);
    setCards(next);
    writeCorpus(next);
    setExpandedIds((current) => current.filter((itemId) => itemId !== id));
  }

  function toggleExpand(id: string) {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] px-4 py-10 md:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[#9B948C]">My Deck</p>
            <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A] md:text-4xl">
              我的卡组 (My Cue Cards)
            </h1>
          </div>

          <Link
            href="/forge"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#1A1A1A] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2A2A2A]"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页继续生成
          </Link>
        </div>

        {!hydrated ? (
          <div className="rounded-[32px] bg-white px-8 py-12 text-center text-sm text-[#9B948C] shadow-sm">
            正在读取你的本地卡组...
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-[32px] bg-white px-8 py-14 text-center shadow-sm">
            <h2 className="mb-3 text-2xl font-bold text-[#1A1A1A]">卡组还是空的</h2>
            <p className="mx-auto mb-6 max-w-xl text-sm leading-relaxed text-[#7C7873]">
              你还没有积累专属语料，快去首页 Cue 一下吧！
            </p>
            <Link
              href="/forge"
              className="inline-flex rounded-2xl bg-[#FACC15] px-5 py-3 text-sm font-semibold text-[#1A1A1A] transition-colors hover:bg-[#EAB308]"
            >
              去生成第一张卡
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((item) => {
              const expanded = expandedIds.includes(item.id);
              const isLong = item.script.length > SCRIPT_PREVIEW_LENGTH;
              const visibleScript =
                expanded || !isLong
                  ? item.script
                  : `${item.script.slice(0, SCRIPT_PREVIEW_LENGTH).trim()}...`;

              return (
                <article
                  key={item.id}
                  className="flex h-full flex-col rounded-[28px] bg-white p-6 shadow-sm"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#B4AEA7]">
                        Cue Card
                      </p>
                      <h2 className="text-base font-bold leading-relaxed text-[#1A1A1A]">
                        {item.cue_card}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="shrink-0 rounded-full bg-[#F7F5F2] p-2 text-[#8B837A] transition-colors hover:bg-[#F0ECE7] hover:text-[#1A1A1A]"
                      aria-label="删除该语料"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {item.scene_tags.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {item.scene_tags.map((tag) => (
                        <span
                          key={`${item.id}-${tag}`}
                          className="rounded-full bg-[#FACC15]/15 px-3 py-1 text-xs font-semibold text-[#A16207]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mb-3 flex-1 rounded-[24px] bg-[#FCFBF9] p-4">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#B4AEA7]">
                      Script
                    </p>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[#5E5953]">
                      {visibleScript}
                    </p>
                  </div>

                  {isLong && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="mb-4 inline-flex items-center gap-1 self-start text-sm font-medium text-[#7C7873] transition-colors hover:text-[#1A1A1A]"
                    >
                      {expanded ? (
                        <>
                          收起全文
                          <ChevronUp className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          点击展开
                          <ChevronDown className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  )}

                  <div className="mt-auto flex items-center justify-between border-t border-[#F2EFEA] pt-4">
                    <p className="text-xs text-[#A49E96]">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString("zh-CN")
                        : "刚刚保存"}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="text-sm font-semibold text-[#B45309] transition-colors hover:text-[#92400E]"
                    >
                      删除
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
