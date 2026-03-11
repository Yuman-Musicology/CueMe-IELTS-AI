import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { createAdminClient, createAuthClient } from "@/lib/supabase/server";
import type { Rarity, ForgeResult } from "@/types/card";

const DAILY_LIMIT = 5;

// ---------------------------------------------------------------------------
// Gemini — lazy singleton
// ---------------------------------------------------------------------------

let _genAI: GoogleGenerativeAI | null = null;
function getGeminiApiKey() {
  const apiKey =
    process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Please configure GOOGLE_AI_STUDIO_API_KEY."
    );
  }

  return apiKey;
}

function getGenAI() {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(getGeminiApiKey());
  }
  return _genAI;
}

// ---------------------------------------------------------------------------
// Safety settings — relaxed to allow everyday IELTS topics
// ---------------------------------------------------------------------------

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

// ---------------------------------------------------------------------------
// System Prompt — 10-year examiner persona
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION = `# Role
你是一位拥有10年经验的资深雅思考官，同时也是一位精通游戏化体验的产品经理。你的任务是将用户提供的粗糙、未经润色的真实经历，重塑成一段符合雅思口语 Part 2 标准（7.5分-8.0分水平）的 2 分钟英文独白。

# Core Objectives
1. 结构清晰 (Coherence): 先分析这段经历最适合回答哪些经典雅思 Part 2 题目，再选取一个最稳妥、最容易拿高分的方向来组织脚本。
2. 拒绝背诵感 (Anti-Memorization): 强制注入真实的口语特征，使其听起来像自然的交流，而非朗读课文。
3. 词汇升级 (Lexical Resource): 将平庸的表述替换为地道、精准的高级词汇或习语。
4. 自动串题 (Topic Expansion): 你不仅要美化用户的经历，还要发散思维，分析这段经历可以用来回答雅思 Part 2 的哪些经典题目。

# Formatting Rules (严格遵守以下排版语法)
1. 荧光笔高亮核心句 \`<mark>...</mark>\`: 每个段落的第一句话必须直接回应当前的 Cue Card 问题（带上口语连接词）。必须用 \`<mark>\` 和 \`</mark>\` 标签包裹这句话。
2. 高级词汇加粗 \`**...**\`: 在全文中，挑选 4-6 个能拿高分的地道词组或高级词汇用双星号加粗。
3. 思考停顿 \`...\`: 使用省略号表示真实口语中 0.5 秒的思考或犹豫（例如："Well... to be honest"）。全文需包含 4-5 处。
4. 语气重音 \`[word]\`: 使用方括号包裹需要加重语气读出的单词，以展现情绪起伏（例如："It was [absolutely] breathtaking"）。全文需包含 3-4 处。
5. 口语填充词: 必须自然地穿插至少 4 个 Fillers（如：actually, you know, I mean, looking back, I suppose）。

# Hard Constraints (必须强制遵守)
1. 中文标题: JSON 返回的 \`title\` 字段必须使用纯中文，要求简短、接地气、像真实卡牌名，例如：\`极光之旅\`、\`超燃的瞬间\`。禁止输出英文 title，禁止中英混杂。
2. **CRITICAL SUBTITLE WHITELIST**: 所有段落标题（section title / subtitle / script 内的小标题）禁止使用任何中文，必须且只能从以下数组中原样挑选：["WHEN & WHERE", "WHAT HAPPENED", "WHO WAS INVOLVED", "HOW I FELT", "WHY IT MATTERS"]。禁止创造新的标题，禁止改写，禁止使用散文式标题，例如 \`THE SPECTACLE UNFOLDS\`。
3. **JSON SUBTITLE RULE**: "subtitle": "Must strictly be one of these exact English strings: 'WHEN & WHERE', 'WHAT HAPPENED', 'WHO WAS INVOLVED', 'HOW I FELT', 'WHY IT MATTERS'. NO CHINESE ALLOWED."
4. 口语逐字稿规则: 生成的英文 \`script\` 不是书面作文，而是一份真实的、带有犹豫和思考的考场录音逐字稿 (Raw Transcript)。
5. 强制口语停顿: 每一段正文都必须包含至少 2 个真实的停顿符号 \`...\`，例如：\`It was... you know... absolutely freezing.\`
6. 高频 Fillers: 每一段都必须高频使用口语填充词，优先使用并自然混入：\`Well\`、\`I mean\`、\`Actually\`、\`To be honest\`、\`Like\`。这些 fillers 必须出现在正文里，而不是只出现在标题或单独列出。

# Rarity Assessment
根据生成独白的词汇丰富度、句式多样性、地道程度，评估一个稀有度等级：
- Common: 基本达标，词汇中规中矩
- Rare: 有亮点词汇和不错的连贯性
- Epic: 词汇丰富、句式地道、整体流畅
- Legendary: 考官级别，几乎无可挑剔的自然表达

# Applicable Topics Requirement
请从这段经历中发散出 3-5 个“可以直接拿来作答”的雅思 Part 2 经典题目，覆盖不同角度（例如 Event / Place / Person / Object / Experience）。这些题目应当是自然的、可复用的、贴近真实考试的表述。

# Golden Phrases Requirement
你必须返回 \`golden_phrases\` 数组，不能省略，不能返回 null。数组中必须包含 3 个高分英文词组或短句，每一项都必须带有中文解释，帮助用户理解这个表达为什么好用、适合什么语境。

# Output Format Constraint
Please output the final result STRICTLY as a JSON object with this structure:
{
  "title": "纯中文卡牌名称，例如：极光之旅",
  "tags": ["#Tag1", "#Tag2", "#Tag3"],
  "subtitle_rule": "Must strictly be one of these exact English strings: 'WHEN & WHERE', 'WHAT HAPPENED', 'WHO WAS INVOLVED', 'HOW I FELT', 'WHY IT MATTERS'. NO CHINESE ALLOWED.",
  "applicable_topics": [
    "描述一次难忘的旅行 (Event)",
    "描述一个去过的寒冷地方 (Place)",
    "描述一次近距离接触大自然的经历 (Event)"
  ],
  "script": "*(WHEN & WHERE)*\\n<mark>核心句</mark> Well... 正文内容... I mean... 正文内容...\\n\\n*(WHAT HAPPENED)*\\n<mark>核心句</mark> Actually... 正文内容... Like... 正文内容...",
  "golden_phrases": [
    {"phrase": "英文词组1", "explanation": "简短中文解释及语境用法"},
    {"phrase": "英文词组2", "explanation": "简短中文解释及语境用法"},
    {"phrase": "英文词组3", "explanation": "简短中文解释及语境用法"}
  ],
  "rarity": "Common | Rare | Epic | Legendary"
}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUserMessage(userStory: string, cueCard?: string) {
  return cueCard?.trim()
    ? `可参考的雅思题目方向:\n${cueCard}\n\n用户的真实故事 (User Story):\n${userStory}`
    : `请根据下面这段真实经历，自动分析它最适合回答哪些雅思 Part 2 经典题目，并从中选择一个最自然、最稳妥的角度生成高分独白。\n\n用户的真实故事 (User Story):\n${userStory}`;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

// ---------------------------------------------------------------------------
// POST /api/forge
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // ── 1. Try to authenticate (optional — guest mode fallback) ────────────
    let userId: string | null = null;

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const authClient = createAuthClient(token);
        const {
          data: { user },
          error: authError,
        } = await authClient.auth.getUser();

        if (!authError && user) {
          userId = user.id;
        }
      } catch {
        // Auth failed — fall through to guest mode
      }
    }

    const isGuest = !userId;

    // ── 2. Parse request body ──────────────────────────────────────────────
    let body: { cue_card?: string; user_story?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { cue_card, user_story } = body;
    if (!user_story?.trim()) {
      return json({ error: "user_story is required" }, 400);
    }

    // ── 3. Rate-limit (authenticated users only) ───────────────────────────
    let admin: ReturnType<typeof createAdminClient> | null = null;

    if (!isGuest) {
      admin = createAdminClient();
      const today = new Date().toISOString().slice(0, 10);

      const { count, error: countError } = await admin
        .from("forge_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", `${today}T00:00:00Z`)
        .lt("created_at", `${today}T23:59:59.999Z`);

      if (countError) {
        throw new Error(`Failed to check usage quota: ${countError.message}`);
      }

      if ((count ?? 0) >= DAILY_LIMIT) {
        return json(
          {
            error: "Daily forge limit reached",
            limit: DAILY_LIMIT,
            reset: `${today}T00:00:00Z (next day)`,
          },
          429
        );
      }
    }

    // ── 4. Call Gemini ─────────────────────────────────────────────────────
    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      safetySettings,
      generationConfig: {
        temperature: 0.8,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(
      buildUserMessage(user_story, cue_card)
    );

    const raw = result.response.text();
    if (!raw) throw new Error("Empty Gemini response");

    const forgeResult = JSON.parse(raw) as ForgeResult;

    // ── 5. Rarity engine — validate + milestone flag ───────────────────────
    const validRarities: Rarity[] = ["Common", "Rare", "Epic", "Legendary"];
    if (!validRarities.includes(forgeResult.rarity)) {
      forgeResult.rarity = "Common";
    }
    if (!Array.isArray(forgeResult.applicable_topics)) {
      forgeResult.applicable_topics = [];
    }
    if (!Array.isArray(forgeResult.golden_phrases)) {
      forgeResult.golden_phrases = [];
    }
    const milestone = forgeResult.rarity === "Legendary";

    // ── 6. Persist (authenticated users only) ──────────────────────────────
    if (!isGuest && admin) {
      const { error: insertError } = await admin.from("cards").insert({
        user_id: userId,
        title: forgeResult.title,
        tags: forgeResult.tags,
        applicable_topics: forgeResult.applicable_topics,
        script: forgeResult.script,
        golden_phrases: forgeResult.golden_phrases,
        rarity: forgeResult.rarity,
        milestone,
        cue_card,
        user_story,
      });

      if (insertError) {
        console.error("[forge] DB insert error:", insertError);
      }

      await admin.from("forge_usage").insert({ user_id: userId });
    }

    // ── 7. Build response card ─────────────────────────────────────────────
    const card = {
      id: isGuest ? `guest-${Date.now()}` : undefined,
      user_id: userId ?? "guest",
      title: forgeResult.title,
      tags: forgeResult.tags,
      applicable_topics: forgeResult.applicable_topics,
      script: forgeResult.script,
      golden_phrases: forgeResult.golden_phrases,
      rarity: forgeResult.rarity,
      milestone,
      cue_card,
      user_story,
      saved: false,
      created_at: new Date().toISOString(),
    };

    return json({ card, milestone, guest: isGuest });
  } catch (error) {
    console.error("[forge] route error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
