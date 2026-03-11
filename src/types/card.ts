export type Rarity = "Common" | "Rare" | "Epic" | "Legendary";

export interface GoldenPhrase {
  phrase: string;
  explanation: string;
}

export interface ForgeResult {
  title: string;
  tags: string[];
  applicable_topics: string[];
  script: string;
  golden_phrases: GoldenPhrase[];
  rarity: Rarity;
}

export interface Card extends ForgeResult {
  id: string;
  user_id: string;
  cue_card: string;
  user_story: string;
  milestone: boolean;
  saved: boolean;
  created_at: string;
}
