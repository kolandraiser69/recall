export interface Quicklink {
  id: string;
  title: string;
  url: string;
  domain: string;
  isFavorite: boolean;
  order: number;
  category?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export const DEFAULT_QUICKLINKS: Omit<Quicklink, 'createdAt' | 'updatedAt' | 'deletedAt'>[] = [
  {
    id: 'ql-quickref',
    title: 'Quickref',
    url: 'https://quickref.me',
    domain: 'quickref.me',
    isFavorite: true,
    order: 0,
    category: 'Reference',
  },
  {
    id: 'ql-claude',
    title: 'Claude',
    url: 'https://claude.ai',
    domain: 'claude.ai',
    isFavorite: true,
    order: 1,
    category: 'AI Assistant',
  },
  {
    id: 'ql-chatgpt',
    title: 'ChatGPT',
    url: 'https://chatgpt.com',
    domain: 'chatgpt.com',
    isFavorite: true,
    order: 2,
    category: 'AI Assistant',
  },
  {
    id: 'ql-gemini',
    title: 'Gemini',
    url: 'https://gemini.google.com',
    domain: 'gemini.google.com',
    isFavorite: true,
    order: 3,
    category: 'AI Assistant',
  },
  {
    id: 'ql-thi-lernportal',
    title: 'THI Lernportal',
    url: 'https://thi-lernportal.vercel.app',
    domain: 'thi-lernportal.vercel.app',
    isFavorite: true,
    order: 4,
    category: 'University',
  },
  {
    id: 'ql-thi-quicklinks',
    title: 'THI Quicklinks',
    url: 'https://thi.de/quicklinks',
    domain: 'thi.de',
    isFavorite: true,
    order: 5,
    category: 'University',
  },
  {
    id: 'ql-pdf24',
    title: 'PDF24 Tools',
    url: 'https://tools.pdf24.org',
    domain: 'tools.pdf24.org',
    isFavorite: false,
    order: 6,
    category: 'Tools',
  },
  {
    id: 'ql-qwen',
    title: 'Qwen Chat',
    url: 'https://chat.qwen.ai',
    domain: 'chat.qwen.ai',
    isFavorite: false,
    order: 7,
    category: 'AI Assistant',
  },
  {
    id: 'ql-learn-anything',
    title: 'Learn Anything',
    url: 'https://learn-anything.xyz',
    domain: 'learn-anything.xyz',
    isFavorite: false,
    order: 8,
    category: 'Learning',
  },
  {
    id: 'ql-thi-exams',
    title: 'THI Exams – Wirtschaftsinformatik',
    url: 'https://exams.studverthi.de/de/informatik/wirtschaftsinformatik/semester_1/einfuehrung_informatik/ws25-26',
    domain: 'exams.studverthi.de',
    isFavorite: true,
    order: 9,
    category: 'University',
  },
  {
    id: 'ql-outlook',
    title: 'Outlook',
    url: 'https://outlook.cloud.microsoft',
    domain: 'outlook.cloud.microsoft',
    isFavorite: true,
    order: 10,
    category: 'University',
  },
];
