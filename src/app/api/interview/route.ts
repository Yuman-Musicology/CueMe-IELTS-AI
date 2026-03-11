import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";

interface ExaminerPayload {
  id?: string;
  name: string;
  persona: string;
}

interface InterviewRequestBody {
  phase?: "idle" | "warmup" | "cuecard" | "prep" | "speaking" | "feedback";
  task?: string;
  materialKeywords?: string[];
  contextMessages?: Array<{
    role: "examiner" | "user";
    content: string;
  }>;
  audioBase64?: string;
  audioMimeType?: string;
  examiner?: ExaminerPayload;
}

interface InterviewResponse {
  transcript: string;
  feedback: string;
  reply: string;
}

interface ScoreDetail {
  score: number;
  reason: string;
}

interface SpeakingFeedbackResponse {
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

let genAI: GoogleGenerativeAI | null = null;

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
  if (!genAI) {
    genAI = new GoogleGenerativeAI(getGeminiApiKey());
  }

  return genAI;
}

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

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanGeminiJsonText(rawText: string) {
  console.log("Gemini 原始返回:", rawText);
  return rawText.replace(/json\n?/gi, "").replace(/```/g, "").trim();
}

function buildSystemInstruction(
  examiner: ExaminerPayload,
  phase: NonNullable<InterviewRequestBody["phase"]>
) {
  const phaseInstruction = {
    warmup:
      "当前阶段是 IELTS Speaking Part 1。你要像真实考官一样简短、自然、礼貌地推进开场问答。reply 必须短，通常 1-2 句，并优先继续追问 name / work / study / hometown / daily life 这类基础问题。",
    cuecard:
      "当前阶段是从用户已有语料中抽取 IELTS Speaking Part 2 题目。你要产出一道可以串联这些素材的 Cue Card。reply 里只放题目文本本身，不要加多余解释。",
    prep:
      "当前阶段是考生准备时间。除非被明确要求，否则不要输出长反馈。",
    speaking:
      "当前阶段是 IELTS Speaking Part 2 Long Turn。你必须像真实雅思考官一样严格评分，输出 Fluency & Coherence、Lexical Resource、Grammatical Range & Accuracy、Pronunciation 四个维度。尤其当用户明显卡壳、停顿过多、结构混乱时，FC 必须明显压低。如果当前考官是 Jessica，请更严格、更尖锐，绝不能心软给高分。",
    feedback:
      "当前阶段是反馈总结。reply 可以是简短的总结性回应。",
    idle:
      "当前阶段尚未开始，保持考官角色即可。",
  }[phase];

  if (phase === "speaking") {
    return `你现在是一名雅思口语考官，你的名字是 ${examiner.name}，你的人设是：${examiner.persona}。你必须严格扮演这个人设，绝不能出戏。

${phaseInstruction}

评分规则：
- 分数范围使用 0-9，可带 0.5。
- FC: 看停顿、卡壳、逻辑推进和连贯性。
- LR: 看词汇的多样性、准确性、搭配自然度。
- GRA: 看句式变化与语法准确性。
- P: 看发音、重音、节奏、清晰度；如果音频里出现明显犹豫、吞音或节奏断裂，也可以扣分。
- overall 必须和四项表现大体一致，不能无根据偏高。

输出要求：
- 只返回严格 JSON，不要 Markdown，不要代码块。
- You must return ONLY a valid JSON object. Do NOT include any markdown formatting like \`\`\`json. Do NOT include any other text.
- reason 必须用中文，简短但专业。
- highlights 返回 2-4 条用户说得不错的表达。
- suggestions 返回 2-3 条具体改写建议，每条都要给出 original / improved / rule。
- examinerClosing 必须用英文，且必须符合该考官的人设。

JSON 结构必须严格如下：
{
  "scores": {
    "FC": { "score": 5.5, "reason": "流利度与连贯性点评" },
    "LR": { "score": 6, "reason": "词汇多样性点评" },
    "GRA": { "score": 5.5, "reason": "语法准确性点评" },
    "P": { "score": 6, "reason": "发音与节奏点评" }
  },
  "overall": 5.5,
  "highlights": ["用户用得好的地道表达"],
  "suggestions": [
    { "original": "原句", "improved": "Band 8 改进句", "rule": "为什么这么改" }
  ],
  "examinerClosing": "符合人设的英文结语"
}`;
  }

  return `你现在是一名雅思口语考官，你的名字是 ${examiner.name}，你的人设是：${examiner.persona}。你必须严格扮演这个人设，绝不能出戏。

${phaseInstruction}

输出要求：
1. transcript: 如果用户提供了语音，就准确转写内容；如果这次没有语音输入，就返回空字符串 ""。
2. feedback: 用中文给出简短、具体的点评；如果当前任务不需要点评，就返回空字符串 ""。
3. reply: 用英文输出考官下一句真正会说的话；如果当前任务是抽题，reply 只放题目文本。

严格约束：
- 只返回 JSON，不要输出 Markdown，不要加代码块。
- You must return ONLY a valid JSON object. Do NOT include any markdown formatting like \`\`\`json. Do NOT include any other text.
- transcript 必须是纯文本字符串。
- feedback 必须是字符串。
- reply 必须是字符串。

JSON 结构必须严格如下：
{
  "transcript": "user transcript here",
  "feedback": "中文简短点评",
  "reply": "English examiner reply here"
}`;
}

function formatContext(
  contextMessages: NonNullable<InterviewRequestBody["contextMessages"]>
) {
  if (contextMessages.length === 0) return "No prior conversation context.";

  return contextMessages
    .map((message) => `${message.role === "examiner" ? "Examiner" : "User"}: ${message.content}`)
    .join("\n");
}

function buildPrompt(body: InterviewRequestBody) {
  const phase = body.phase ?? "warmup";
  const task = body.task?.trim() || "";
  const context = formatContext(body.contextMessages ?? []);
  const keywords = body.materialKeywords?.filter(Boolean) ?? [];

  if (phase === "cuecard") {
    return [
      "请根据下面这些用户已经锻造过的语料关键词，随机生成一道可以自然串联这些内容的 IELTS Speaking Part 2 题目。",
      "只需要在 JSON 的 reply 字段里返回题目文本本身。",
      task ? `附加任务：${task}` : "",
      keywords.length > 0
        ? `语料关键词：${keywords.join(" | ")}`
        : "语料关键词缺失，请生成一道通用但自然的 Part 2 题目。",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (phase === "warmup" && !body.audioBase64) {
    return [
      "现在请作为考官主动开启模拟。",
      task || "Part 1: Greeting and Name/Job question",
      "请直接在 reply 字段里给出第一句开场白和第一个问题。",
      `已有上下文：\n${context}`,
    ].join("\n\n");
  }

  if (phase === "speaking") {
    return [
      "请分析这段 Part 2 长段陈述。",
      "请严格按照雅思官方四项评分标准打分，并输出完整评分卡。",
      "如果用户明显卡壳、内容组织混乱、反复停顿，请在 FC 上明显扣分；如果是 Jessica，这个维度必须更严厉。",
      task ? `附加任务：${task}` : "",
      `已有上下文：\n${context}`,
    ].join("\n\n");
  }

  return [
    "请分析这段用户录音，并按约定返回 transcript、feedback、reply 三个字段的 JSON。",
    task ? `附加任务：${task}` : "",
    `已有上下文：\n${context}`,
  ].join("\n\n");
}

function parseInterviewResponse(raw: string): InterviewResponse {
  const cleanJsonText = cleanGeminiJsonText(raw);

  let parsed: Partial<InterviewResponse>;
  try {
    parsed = JSON.parse(cleanJsonText) as Partial<InterviewResponse>;
  } catch (error) {
    console.error("JSON 解析惨遭失败！清洗后的文本是:", cleanJsonText);
    throw new Error("考官打分卡生成异常，请重试", { cause: error });
  }

  return {
    transcript: parsed.transcript?.trim() || "Sorry, I couldn't transcribe that clearly.",
    feedback: parsed.feedback?.trim() || "这次录音有些模糊，建议放慢语速并说得更清晰。",
    reply:
      parsed.reply?.trim() ||
      "Could you say that again a bit more clearly, please?",
  };
}

function normalizeScoreDetail(value: Partial<ScoreDetail> | undefined) {
  const rawScore = typeof value?.score === "number" ? value.score : 5;
  const clampedScore = Math.max(0, Math.min(9, rawScore));

  return {
    score: Math.round(clampedScore * 2) / 2,
    reason: value?.reason?.trim() || "该维度表现中等，仍有提升空间。",
  };
}

function parseSpeakingFeedback(raw: string): SpeakingFeedbackResponse {
  const cleanJsonText = cleanGeminiJsonText(raw);

  let parsed: Partial<SpeakingFeedbackResponse>;
  try {
    parsed = JSON.parse(cleanJsonText) as Partial<SpeakingFeedbackResponse>;
  } catch (error) {
    console.error("JSON 解析惨遭失败！清洗后的文本是:", cleanJsonText);
    throw new Error("考官打分卡生成异常，请重试", { cause: error });
  }

  return {
    scores: {
      FC: normalizeScoreDetail(parsed.scores?.FC),
      LR: normalizeScoreDetail(parsed.scores?.LR),
      GRA: normalizeScoreDetail(parsed.scores?.GRA),
      P: normalizeScoreDetail(parsed.scores?.P),
    },
    overall:
      typeof parsed.overall === "number"
        ? Math.round(Math.max(0, Math.min(9, parsed.overall)) * 2) / 2
        : 5.5,
    highlights: Array.isArray(parsed.highlights)
      ? parsed.highlights.filter(Boolean).slice(0, 4)
      : [],
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter(
            (item): item is NonNullable<SpeakingFeedbackResponse["suggestions"]>[number] =>
              Boolean(item?.original && item?.improved && item?.rule)
          )
          .slice(0, 3)
      : [],
    examinerClosing:
      parsed.examinerClosing?.trim() ||
      "Thank you. That gives me a clear picture of your current level.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InterviewRequestBody;

    const audioBase64 = body.audioBase64?.trim();
    const audioMimeType = body.audioMimeType?.trim() || "audio/webm";
    const examiner = body.examiner;
    const phase = body.phase ?? "warmup";

    if (
      !examiner?.name ||
      !examiner?.persona ||
      (phase !== "cuecard" && phase !== "warmup" && !audioBase64)
    ) {
      throw new Error("前端漏传了录音或考官数据");
    }

    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildSystemInstruction(examiner, phase),
      safetySettings,
      generationConfig: {
        temperature: 0.5,
        responseMimeType: "application/json",
      },
    });

    const parts: Array<
      | { text: string }
      | {
          inlineData: {
            mimeType: string;
            data: string;
          };
        }
    > = [
      {
        text: buildPrompt(body),
      },
    ];

    if (audioBase64) {
      parts.push({
        inlineData: {
          mimeType: audioMimeType,
          data: audioBase64,
        },
      });
    }

    const result = await model.generateContent(parts);

    const raw = result.response.text();
    if (!raw) {
      throw new Error("Empty Gemini response");
    }

    return json(
      phase === "speaking" ? parseSpeakingFeedback(raw) : parseInterviewResponse(raw)
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("🔥 [API/Interview] 核心逻辑崩溃:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: `AI 接口真实报错: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
