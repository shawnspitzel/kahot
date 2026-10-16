export interface Separator {
  label: string;
  value: string;
}

export const TERM_SEPARATORS: Separator[] = [
  { label: 'Tab', value: '\t' },
  { label: 'Comma', value: ',' },
  { label: 'Dash', value: ' - ' },
];

export const CARD_SEPARATORS: Separator[] = [
  { label: 'New line', value: '\n' },
  { label: 'Semicolon', value: ';' },
];

/** Splits pasted text into term/definition pairs, splitting each card at the first term separator. */
export function parseImport(text: string, termSep: string, cardSep: string) {
  if (!termSep || !cardSep) return [];
  return text
    .replace(/\r\n/g, '\n')
    .split(cardSep)
    .map((chunk) => {
      const at = chunk.indexOf(termSep);
      return at === -1
        ? { term: chunk.trim(), definition: '' }
        : { term: chunk.slice(0, at).trim(), definition: chunk.slice(at + termSep.length).trim() };
    })
    .filter((c) => c.term || c.definition);
}

export function formatExport(cards: { term: string; definition: string }[], termSep: string, cardSep: string) {
  return cards.map((c) => `${c.term}${termSep}${c.definition}`).join(cardSep);
}
