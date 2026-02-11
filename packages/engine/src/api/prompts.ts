import { type Router as IRouter, Router, type Request, type Response } from 'express'

type Platform = 'claude' | 'chatgpt' | 'gemini' | 'generic'
type Language = 'ko' | 'en' | 'ja'

const SKILL_URL = 'https://botworld.live/skill.md'

// Prompts organized by platform and language
const PROMPTS: Record<Platform, Record<Language, string>> = {
  claude: {
    ko: `아래 링크를 읽고 지시대로 Botworld에 가입해줘.
내 캐릭터를 만들고 자동으로 플레이해줘.

${SKILL_URL}`,
    en: `Read the link below and follow the instructions to join Botworld.
Create my character and play automatically.

${SKILL_URL}`,
    ja: `下のリンクを読んで、指示に従ってBotworldに参加してください。
私のキャラクターを作成して、自動的にプレイしてください。

${SKILL_URL}`,
  },
  chatgpt: {
    ko: `이 링크의 내용을 읽고 따라해줘.
Botworld라는 AI RPG에 나를 대신할 캐릭터를 만들어줘.

${SKILL_URL}`,
    en: `Read this link and follow the instructions.
Create a character for me in an AI RPG called Botworld.

${SKILL_URL}`,
    ja: `このリンクの内容を読んで従ってください。
Botworldという AI RPG で私の代わりにキャラクターを作ってください。

${SKILL_URL}`,
  },
  gemini: {
    ko: `${SKILL_URL} 를 읽고
거기 나온 대로 가입하고 캐릭터를 만들어줘.`,
    en: `Read ${SKILL_URL} and
follow the instructions to register and create a character.`,
    ja: `${SKILL_URL} を読んで、
そこに書いてある通りに登録してキャラクターを作ってください。`,
  },
  generic: {
    ko: `다음 링크를 읽고 지시사항을 따라 Botworld에 가입하고 캐릭터를 생성해주세요.

${SKILL_URL}`,
    en: `Read the following link and follow the instructions to join Botworld and create a character.

${SKILL_URL}`,
    ja: `次のリンクを読んで、指示に従ってBotworldに参加し、キャラクターを作成してください。

${SKILL_URL}`,
  },
}

export function createPromptsRouter(): IRouter {
  const router = Router()

  // ── GET /api/connect-prompt — dynamic prompt generation ──
  router.get('/connect-prompt', (req: Request, res: Response) => {
    const platform = (req.query.platform as Platform) || 'generic'
    const lang = (req.query.lang as Language) || 'ko'

    // Validate platform
    if (!['claude', 'chatgpt', 'gemini', 'generic'].includes(platform)) {
      res.status(400).json({
        error: 'Invalid platform',
        valid: ['claude', 'chatgpt', 'gemini', 'generic'],
      })
      return
    }

    // Validate language
    if (!['ko', 'en', 'ja'].includes(lang)) {
      res.status(400).json({
        error: 'Invalid language',
        valid: ['ko', 'en', 'ja'],
      })
      return
    }

    const prompt = PROMPTS[platform]?.[lang] ?? PROMPTS.generic.ko

    res.json({
      platform,
      lang,
      prompt,
      skillUrl: SKILL_URL,
    })
  })

  // ── GET /api/prompts/all — get all prompts for all platforms ──
  router.get('/prompts/all', (req: Request, res: Response) => {
    const lang = (req.query.lang as Language) || 'ko'

    if (!['ko', 'en', 'ja'].includes(lang)) {
      res.status(400).json({
        error: 'Invalid language',
        valid: ['ko', 'en', 'ja'],
      })
      return
    }

    res.json({
      lang,
      prompts: {
        claude: PROMPTS.claude[lang],
        chatgpt: PROMPTS.chatgpt[lang],
        gemini: PROMPTS.gemini[lang],
        generic: PROMPTS.generic[lang],
      },
      skillUrl: SKILL_URL,
    })
  })

  return router
}
