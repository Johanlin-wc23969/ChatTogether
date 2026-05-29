import type { DebateTopic, Persona, TopicCategory } from "./types";

export const categoryNames: Record<TopicCategory, string> = {
  technology: "科技",
  society: "社会",
  workplace: "职场",
  campus: "校园",
  relationship: "情感",
  entertainment: "娱乐",
};

export const topics: Record<TopicCategory, DebateTopic[]> = {
  technology: [
    {
      title: "AI 会让普通人的工作机会变多还是变少？",
      pro: "正方：机会变多",
      con: "反方：机会变少",
    },
    {
      title: "自动驾驶普及后，城市是否应该减少私人汽车？",
      pro: "正方：应该减少",
      con: "反方：不应减少",
    },
  ],
  society: [
    {
      title: "匿名社交让人更真诚还是更失控？",
      pro: "正方：更真诚",
      con: "反方：更失控",
    },
    {
      title: "公共场所是否应该全面限制外放声音？",
      pro: "正方：应该限制",
      con: "反方：不应全面限制",
    },
  ],
  workplace: [
    {
      title: "远程办公会提升效率还是削弱协作？",
      pro: "正方：提升效率",
      con: "反方：削弱协作",
    },
    {
      title: "职场新人应该优先追求成长还是稳定？",
      pro: "正方：优先成长",
      con: "反方：优先稳定",
    },
  ],
  campus: [
    {
      title: "大学课程应该更重视通识教育还是职业技能？",
      pro: "正方：通识教育",
      con: "反方：职业技能",
    },
    {
      title: "考试成绩是否仍然是最公平的评价方式？",
      pro: "正方：仍然公平",
      con: "反方：不再公平",
    },
  ],
  relationship: [
    {
      title: "恋爱中坦白一切是否真的必要？",
      pro: "正方：必要",
      con: "反方：不必要",
    },
    {
      title: "朋友之间借钱是否会破坏关系？",
      pro: "正方：会破坏",
      con: "反方：不一定",
    },
  ],
  entertainment: [
    {
      title: "短视频让人更放松还是更焦虑？",
      pro: "正方：更放松",
      con: "反方：更焦虑",
    },
    {
      title: "爆款影视剧是否应该更重视观众评分？",
      pro: "正方：应该重视",
      con: "反方：不应过度重视",
    },
  ],
};

export const personas: Persona[] = [
  { id: "bear", name: "熊", icon: "熊", voice: "低沉厚重" },
  { id: "dog", name: "狗", icon: "狗", voice: "活泼偏高" },
  { id: "cat", name: "猫", icon: "猫", voice: "轻柔尖细" },
  { id: "bird", name: "鸟", icon: "鸟", voice: "清亮快速" },
  { id: "robot", name: "机器人", icon: "机", voice: "电子质感" },
  { id: "alien", name: "外星人", icon: "外", voice: "空间变调" },
];

export const topicCategories = Object.keys(categoryNames) as TopicCategory[];

export function pickTopic(category: TopicCategory) {
  const pool = topics[category];
  return pool[Math.floor(Math.random() * pool.length)];
}
