import { WIRES, type CollarParsedAction, type Wire } from '../shared/collar-types.js';

const wireFrom = (value: string): Wire => ({ 红: 'red', 蓝: 'blue', 黄: 'yellow' })[value] as Wire;

export function parseCollarReply(
  raw: string,
  options: { loose?: boolean } = {},
): CollarParsedAction[] {
  const text = raw
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ');
  const results: CollarParsedAction[] = [];
  for (const match of text.matchAll(
    /【\s*剪线\s*[：:]\s*(\d+)\s*号?\s*[-—－]\s*([红蓝黄])\s*线?\s*】/g,
  )) {
    const wire = wireFrom(match[2]);
    if (WIRES.includes(wire))
      results.push({
        kind: 'cut_wire',
        targetSeat: Number(match[1]),
        wire,
        matched: match[0],
      });
  }
  for (const match of text.matchAll(/【\s*使用保险\s*】/g))
    results.push({ kind: 'use_insurance', matched: match[0] });
  for (const match of text.matchAll(/【\s*接受剪线\s*】/g))
    results.push({ kind: 'accept_cut', matched: match[0] });
  for (const match of text.matchAll(/【\s*公开发言\s*】\s*(.*?)(?=【|$)/g))
    results.push({ kind: 'collar_speech', text: match[1].trim(), matched: match[0] });
  if (!options.loose || results.length) return results;

  for (const match of text.matchAll(
    /(?:^|\s)剪线\s*[：:]?\s*(\d+)\s*号?\s*[-—－]\s*([红蓝黄])\s*线?/g,
  )) {
    const wire = wireFrom(match[2]);
    if (WIRES.includes(wire))
      results.push({
        kind: 'cut_wire',
        targetSeat: Number(match[1]),
        wire,
        matched: match[0].trim(),
      });
  }
  for (const match of text.matchAll(/(?:^|\s)使用保险(?=\s|$)/g))
    results.push({ kind: 'use_insurance', matched: match[0].trim() });
  for (const match of text.matchAll(/(?:^|\s)接受剪线(?=\s|$)/g))
    results.push({ kind: 'accept_cut', matched: match[0].trim() });
  const speech = text.match(/(?:^|\s)公开发言\s*[：:]\s*(.+)$/);
  if (speech)
    results.push({ kind: 'collar_speech', text: speech[1].trim(), matched: speech[0].trim() });
  return results;
}
