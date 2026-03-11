"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";

const STORAGE_KEY = "cueme_user_corpus";
const SCRIPT_PREVIEW_LENGTH = 220;

interface DeckItem {
  id: string;
  title: string;
  cue_card: string;
  script: string;
  scene_tags: string[];
  created_at: string;
}

export default function DeckPage() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<DeckItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setData(parsed.sort((a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          ));
        }
      } catch (e) {
        console.error(e);
      }
    }
    setMounted(true);
  }, []);

  function handleDelete(id: string) {
    const next = data.filter((item) => item.id !== id);
    setData(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function toggleExpand(id: string) {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    );
  }

  if (!mounted) {
    return <div className="min-h-screen bg-[#F5F2ED]" />;
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
            className="inline-flex items-centerounded-2xl bg-[#1A1A1A] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2A2A2A]"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页继续生成
          </Link>
        </div>
        {data.length === 0 ? (
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
            {data.map((item) => {
              const expanded = expandedIds.includes(item.id);
              const isLong = (item.script?.length ?? 0) > SCRIPT_PREVIEW_LENGTH;
              const visibleScript = expanded || !isLong
                ? item.script
                : item.script?.slice(0, SCRIPT_PREVIEW_LENGTH).trim() + "...";
              return (
                <article key={item.id} className="flex h-full flex-col rounded-[28px] bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#B4AEA7]">Cue Card</p>
                      <h2 className="text-base font-bold leading-relaxed text-[#1A1A1A]">{item.cue_card || item.title}</h2>
                    </div>
                    <button onClick={() => handleDelete(item.id)} className="shrink-0 rounded-full bg-[#F7F5F2] p-2 text-[#8B837A] hover:bg-[#F0ECE7] hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {item.scene_tags?.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {item.scene_tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-[#FACC15]/15 px-3 py-1 text-xs font-semibold text-[#A16207]">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="mb-3 flex-1 rounded-[24px] bg-[#FCFBF9] p-4">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#B4AEA7]">Script</p>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[#5E5953]">{visibleScript}</p>
                  </div>
                  {isLong && (
                    <button onClick={() => toggleExpand(item.id)} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#7C7873] hover:text-[#1A1A1A]">
                      {expanded ? "收起全文" : "点击展开"}
    </button>
                  )}
                  <div className="mt-auto border-t border-[#F2EFEA] pt-4 text-xs text-[#A49E96]">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : "刚刚保存"}
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
