import type { Topic, LearningProposal } from "./types";

export const topics: Topic[] = [
  {
    id: "t1",
    title: "为什么很多人一加混响就糊？",
    column: "yueli",
    whyNow: "近期效果器与混音讨论持续活跃，且问题对初学者非常直观。",
    voxAngle: "从“在家听着很爽，进乐队就像掉进游泳池”切入。",
    source: "小红书讨论 + 音乐制作行业内容",
    freshness: 7.4,
    voxFit: 9.3,
    audible: 9.6,
    format: "图文 / A-B 听感解释"
  },
  {
    id: "t2",
    title: "groove 为什么会让身体先动起来？",
    column: "yueli",
    whyNow: "适合连接节奏、编曲与现场体验。",
    voxAngle: "从身体感觉解释重音、微时值与低频落点。",
    source: "抖音音乐讨论 + 行业内容",
    freshness: 8.1,
    voxFit: 9.2,
    audible: 9.4,
    format: "图文 / 短视频脚本"
  },
  {
    id: "t3",
    title: "演唱会坐哪里，真的会改变你听到的东西吗？",
    column: "yueshi",
    whyNow: "现场演出季适合做听感科普。",
    voxAngle: "从普通观众选座进入空间声学与现场体验。",
    source: "行业新闻 + 演出讨论",
    freshness: 8.6,
    voxFit: 8.8,
    audible: 8.9,
    format: "图文 / 长图"
  },
  {
    id: "t4",
    title: "四个和弦为什么真的能写出那么多歌？",
    column: "yueli",
    whyNow: "新手创作类内容长期稳定。",
    voxAngle: "不是背和弦公式，而是解释听觉预期和旋律自由度。",
    source: "小红书 + 抖音新手创作讨论",
    freshness: 6.9,
    voxFit: 9.1,
    audible: 8.7,
    format: "图文"
  },
  {
    id: "t5",
    title: "一支乐队真正开始像乐队，是从什么时候开始的？",
    column: "yueshi",
    whyNow: "适合结合 VOX 合奏课堂和真实排练素材。",
    voxAngle: "从“同时弹”到“彼此给位置”。",
    source: "VOX 自有素材 + 合奏讨论",
    freshness: 7.8,
    voxFit: 9.8,
    audible: 9.2,
    format: "课堂切片 / 图文"
  }
];

export const proposals: LearningProposal[] = [
  {
    id: "p1",
    rule: "减少“不是 A，而是 B”式模板化转折",
    evidence: ["#021", "#022", "#026", "#028"],
    confidence: 0.91,
    oldRule: "无明确规则",
    newRule: "除非语义确实存在明确对立，否则避免用“不是 A，而是 B”制造观点力度。"
  },
  {
    id: "p2",
    rule: "从具体场景进入，再引出抽象观点",
    evidence: ["#021", "#024", "#026"],
    confidence: 0.86,
    oldRule: "允许抽象解释后举例",
    newRule: "优先使用真实场景、听觉瞬间或生活经验开场，再自然引出技术解释。"
  }
];
