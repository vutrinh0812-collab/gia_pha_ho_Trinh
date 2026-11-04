/**
 * Vietnamese diacritic-insensitive search ("vu dang tan" matches "Vũ Đăng Tấn").
 */

/** Lower-case, strip diacritics (incl. đ → d) and collapse whitespace. */
export function normalizeVi(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchItem {
  id: string;
  /** Primary name, as displayed. */
  name: string;
  /** Other names (húy, tự, hiệu…) also matched. */
  aliases?: string[];
}

interface Entry {
  id: string;
  name: string;
  lower: string;
  norm: string;
  words: string[];
  aliasNorm: string[];
}

export interface SearchIndex {
  entries: Entry[];
}

export function buildSearchIndex(items: Iterable<SearchItem>): SearchIndex {
  const entries: Entry[] = [];
  for (const item of items) {
    const norm = normalizeVi(item.name);
    entries.push({
      id: item.id,
      name: item.name,
      lower: item.name.toLowerCase(),
      norm,
      words: norm.split(' '),
      aliasNorm: (item.aliases ?? []).map(normalizeVi).filter(Boolean),
    });
  }
  return { entries };
}

export interface SearchHit {
  id: string;
  score: number;
}

/**
 * Ranks: exact name → name starts with query → every query word starts a
 * name word (in order) → given name match → substring → alias match.
 * A query typed with the right diacritics ranks those names first.
 */
export function search(index: SearchIndex, query: string, limit = 50): SearchHit[] {
  const q = normalizeVi(query);
  if (!q) return [];
  const qWords = q.split(' ');
  const qLower = query.toLowerCase().replace(/\s+/g, ' ').trim();
  const hasMarks = q !== qLower;
  const hits: SearchHit[] = [];

  for (const e of index.entries) {
    let score: number | null = null;
    if (e.norm === q) score = 0;
    else if (e.norm.startsWith(q)) score = 10;
    else if (wordsInOrder(e.words, qWords)) score = 20;
    else if (qWords.length === 1 && e.words[e.words.length - 1]!.startsWith(q)) score = 25;
    else if (e.norm.includes(q)) score = 30;
    else if (e.aliasNorm.some((a) => a.includes(q))) score = 40;
    if (score === null) continue;
    if (hasMarks && !e.lower.includes(qLower)) score += 5;
    // Shorter names first among equals, so "Trịnh An" beats "Trịnh An Khang".
    hits.push({ id: e.id, score: score + Math.min(e.norm.length, 60) / 100 });
  }
  hits.sort((a, b) => a.score - b.score || (a.id < b.id ? -1 : 1));
  return hits.slice(0, limit);
}

/** Every query word is a prefix of some name word, in the same order. */
function wordsInOrder(words: string[], qWords: string[]): boolean {
  let i = 0;
  for (const w of words) {
    if (i < qWords.length && w.startsWith(qWords[i]!)) i++;
  }
  return i === qWords.length;
}
