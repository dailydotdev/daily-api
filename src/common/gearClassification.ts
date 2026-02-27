import { GearCategory } from './gearCategory';

type ClassificationResult = {
  category: GearCategory;
  confident: boolean;
};

const categoryKeywords: [GearCategory, string[]][] = [
  [
    GearCategory.Computer,
    [
      'macbook',
      'laptop',
      'imac',
      'thinkpad',
      'desktop',
      'mac mini',
      'mac pro',
      'mac studio',
      'surface',
      'chromebook',
      'dell xps',
      'lenovo',
    ],
  ],
  [
    GearCategory.Monitor,
    [
      'monitor',
      'display',
      'screen',
      'ultrawide',
      'studio display',
      'pro display',
    ],
  ],
  [
    GearCategory.Keyboard,
    ['keyboard', 'keychron', 'hhkb', 'nuphy', 'mx keys', 'ducky', 'topre'],
  ],
  [
    GearCategory.Mouse,
    [
      'mouse',
      'trackpad',
      'trackball',
      'mx master',
      'magic trackpad',
      'mx ergo',
    ],
  ],
  [
    GearCategory.Headphones,
    [
      'headphone',
      'headset',
      'airpods',
      'earbuds',
      'sony wh-',
      'bose qc',
      'wf-1000',
    ],
  ],
  [
    GearCategory.Desk,
    [
      'desk',
      'chair',
      'herman miller',
      'secretlab',
      'uplift',
      'jarvis',
      'standing desk',
    ],
  ],
  [GearCategory.Webcam, ['webcam', 'facecam', 'brio', 'insta360', 'opal']],
  [
    GearCategory.Microphone,
    [
      'microphone',
      'mic',
      'blue yeti',
      'shure',
      'rode',
      'elgato wave',
      'at2020',
    ],
  ],
];

export const classifyGearName = (name: string): ClassificationResult => {
  const lower = name.toLowerCase();
  const matched: GearCategory[] = [];

  for (const [category, keywords] of categoryKeywords) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(category);
    }
  }

  if (matched.length === 1) {
    return { category: matched[0], confident: true };
  }

  if (matched.length > 1) {
    return { category: matched[0], confident: false };
  }

  return { category: GearCategory.Other, confident: false };
};
