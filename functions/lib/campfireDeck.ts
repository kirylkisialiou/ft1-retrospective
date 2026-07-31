export type Category = 'plus' | 'minus' | 'thanks' | 'improve'

export interface CampPrompt {
  category: Category
  title: string
  body: string
}

export const CAMPFIRE_DECK: CampPrompt[] = [
  {
    category: 'minus',
    title: 'Блокер с характером',
    body: 'Зависимость от другой команды, которая «почти готова». Нельзя работать, а спрашивать ещё рано — неловко.',
  },
  {
    category: 'plus',
    title: 'Один общий контур',
    body: 'Когда стенд один, QA тестирует фичу, а не ищет, в какой вселенной она сейчас живёт.',
  },
  {
    category: 'thanks',
    title: 'Спасибо за legacy-навигацию',
    body: 'Тем, кто помнит, почему код написан именно так — и спас новичка от археологии.',
  },
  {
    category: 'improve',
    title: 'Дать QA ранний билд',
    body: 'Чем раньше тестер видит фичу, тем меньше финальная проверка превращается в квест с таймером.',
  },
  {
    category: 'minus',
    title: 'Встреча ради встречи',
    body: 'Синк на час, где все узнали, что все и так всё знают. Можно ли было написать в тред?',
  },
  {
    category: 'plus',
    title: 'Парный разбор бага',
    body: 'Когда два человека смотрят в один экран и через 15 минут баг стыдливо уходит сам.',
  },
  {
    category: 'thanks',
    title: 'Кто прикрыл релиз',
    body: 'Спасибо человеку, который остался «на всякий случай» и превратил всякий случай в спокойный вечер.',
  },
  {
    category: 'improve',
    title: 'Definition of Done без тумана',
    body: '«Готово» и «почти готово» — разные страны. Как сделать границу видимой для всей FT1?',
  },
  {
    category: 'minus',
    title: 'Контекст потерялся в чате',
    body: 'Решение приняли в трёх тредах, а тикет всё ещё верит в старую правду.',
  },
  {
    category: 'plus',
    title: 'Маленький рефакторинг вовремя',
    body: 'Не «большой рефакторинг когда-нибудь», а точечный — и следующий спринт уже дышит легче.',
  },
  {
    category: 'thanks',
    title: 'Спасибо за честный «не знаю»',
    body: 'Лучше честный пробел, чем уверенный миф. Кто помог команде не гадать?',
  },
  {
    category: 'improve',
    title: 'Меньше героизма, больше процесса',
    body: 'Если релиз держится на одном человеке — это не надёжность, а костёр из одной спички на ветру.',
  },
  {
    category: 'minus',
    title: 'Тикет-хамелеон',
    body: 'Начали с кнопки, закончили микросервисом. Scope расползся тише, чем баг в проде.',
  },
  {
    category: 'plus',
    title: 'Демо без стыда',
    body: 'Показали сырое — и получили фидбек до того, как полировать не то.',
  },
  {
    category: 'thanks',
    title: 'Кто объяснил бизнесу',
    body: 'Спасибо за перевод с технического на человеческий без потери смысла.',
  },
  {
    category: 'improve',
    title: 'Ретро-действия не в костёр',
    body: 'Прошлый спринт что-то обещал. Что из этого реально попало в бэклог, а что растворилось в дыму?',
  },
  {
    category: 'minus',
    title: 'Флейки в CI',
    body: 'Красный пайплайн, который «иногда сам проходит». Как перестать гадать на кофейной гуще перед мержем?',
  },
  {
    category: 'plus',
    title: 'Хороший код-ревью',
    body: 'Не «LGTM», а пара замечаний, после которых код стал понятнее и тебе, и соседу по лагерю.',
  },
  {
    category: 'thanks',
    title: 'Спасибо за онбординг',
    body: 'Кто провёл по репо так, что новый человек не чувствовал себя в лабиринте без карты.',
  },
  {
    category: 'improve',
    title: 'Тишина на стендапе',
    body: 'Если все «норм, без блокеров», а потом вдруг горит — как сделать, чтобы блокеры всплывали раньше?',
  },
]

const CATEGORIES: Category[] = ['plus', 'minus', 'thanks', 'improve']
export const COLUMN_TARGET = 2

const LABELS: Record<Category, string> = {
  plus: 'плюс',
  minus: 'минус',
  thanks: 'спасибо',
  improve: 'улучшить',
}

export interface ExistingCard {
  category: string
  title: string
  source: string
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** См. src/lib/deal.ts — замена колоды + добор до COLUMN_TARGET по human-картам. */
export function drawCampfireHand(existing: ExistingCard[]) {
  const human = existing.filter((c) => c.source === 'human')
  const used = new Set(human.map((c) => c.title))
  const pools = new Map<Category, CampPrompt[]>()

  for (const prompt of shuffle(CAMPFIRE_DECK)) {
    if (used.has(prompt.title)) continue
    const list = pools.get(prompt.category) ?? []
    list.push(prompt)
    pools.set(prompt.category, list)
  }

  const cards: CampPrompt[] = []

  for (const category of CATEGORIES) {
    const humanInCol = human.filter((c) => c.category === category).length
    const need = Math.max(0, COLUMN_TARGET - humanInCol)
    if (need === 0) continue

    const pool = pools.get(category) ?? []
    const fallback = shuffle(
      CAMPFIRE_DECK.filter((p) => p.category === category),
    )
    const source = pool.length ? pool : fallback

    for (let i = 0; i < need; i += 1) {
      const prompt = source[i]
      if (!prompt) break
      cards.push(prompt)
    }
  }

  const labels = [...new Set(cards.map((c) => LABELS[c.category]))].join(', ')
  const summary =
    cards.length === 0
      ? 'Во всех колонках уже достаточно своих карт — колода отдыхает.'
      : `У костра раздали ${cards.length}: ${labels}.`

  return { cards, summary }
}
