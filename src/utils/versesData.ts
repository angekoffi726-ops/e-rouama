export interface DailyVerse {
  verse: string;
  reference: string;
}

export const DAILY_INSPIRATIONAL_VERSES: DailyVerse[] = [
  {
    verse: "« Car là où deux ou trois sont assemblés en mon nom, je suis au milieu d'eux. »",
    reference: "Matthieu 18:20",
  },
  {
    verse: "« Que tout ce que vous faites soit fait avec amour. »",
    reference: "1 Corinthiens 16:14",
  },
  {
    verse: "« Je puis tout par celui qui me fortifie. »",
    reference: "Philippiens 4:13",
  },
  {
    verse: "« Le Seigneur est mon berger, je ne manque de rien. »",
    reference: "Psaume 23:1",
  },
  {
    verse: "« Soyez forts et prenez courage, ne craignez point et ne soyez point effrayés, car l'Éternel, ton Dieu, marche avec toi. »",
    reference: "Deutéronome 31:6",
  },
  {
    verse: "« Recherchez le bien de la communauté et priez le Seigneur en sa faveur, car de son bien dépend le vôtre. »",
    reference: "Jérémie 29:7",
  },
  {
    verse: "« Aimez-vous les uns les autres comme je vous ai aimés. »",
    reference: "Jean 15:12",
  },
  {
    verse: "« Marchez d'une manière digne de la vocation qui vous a été adressée, en toute humilité et douceur, avec patience, vous supportant les uns les autres avec amour. »",
    reference: "Éphésiens 4:1-2",
  },
  {
    verse: "« Ne vous inquiétez de rien ; mais en toute chose faites connaître vos besoins à Dieu par des prières et des supplications, avec des actions de grâces. »",
    reference: "Philippiens 4:6",
  },
  {
    verse: "« C'est ici le jour que le Seigneur a fait ; qu'il soit pour nous un sujet d'allégresse et de joie ! »",
    reference: "Psaume 118:24",
  },
  {
    verse: "« Portez les fardeaux les uns des autres, et vous accomplirez ainsi la loi de Christ. »",
    reference: "Galates 6:2",
  },
  {
    verse: "« Confie-toi en l'Éternel de tout ton cœur, et ne t'appuie pas sur ta propre sagesse. »",
    reference: "Proverbes 3:5",
  },
  {
    verse: "« Soyez toujours joyeux, priez sans cesse, rendez grâces en toutes choses. »",
    reference: "1 Thessaloniciens 5:16-18",
  },
  {
    verse: "« Le fruit de l'Esprit, c'est l'amour, la joie, la paix, la patience, la bonté, la bienveillance, la foi, la douceur, la maîtrise de soi. »",
    reference: "Galates 5:22-23",
  },
  {
    verse: "« Nous savons que toutes choses concourent au bien de ceux qui aiment Dieu. »",
    reference: "Romains 8:28",
  }
];

export function getDailyVerseForDate(date: Date = new Date()): DailyVerse {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const index = Math.abs(dayOfYear) % DAILY_INSPIRATIONAL_VERSES.length;
  return DAILY_INSPIRATIONAL_VERSES[index];
}
