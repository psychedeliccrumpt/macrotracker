import React from 'react';

// Minimal, dependency-free renderer for the simple markdown the coach writes:
// #/##/### headings, **bold**, *italic*, `code`, - and 1. lists, paragraphs.
// Text is rendered as React nodes (never as HTML), so it cannot inject markup.

const inline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith('**')) nodes.push(<strong key={key} className="font-black">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) nodes.push(<code key={key} className="font-mono text-[0.9em] bg-secondary/10 px-1">{tok.slice(1, -1)}</code>);
    else nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

const Markdown: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const blocks: React.ReactNode[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const cls = level <= 2
        ? 'font-black uppercase tracking-tight text-base mt-3 first:mt-0'
        : 'font-black uppercase tracking-wider text-xs mt-3 first:mt-0';
      blocks.push(<p key={k++} className={cls}>{inline(heading[2], `h${k}`)}</p>);
      i++;
      continue;
    }

    const isBullet = (l: string) => /^\s*[-*•]\s+/.test(l);
    const isNumbered = (l: string) => /^\s*\d+[.)]\s+/.test(l);
    if (isBullet(line) || isNumbered(line)) {
      const ordered = isNumbered(line);
      const items: React.ReactNode[] = [];
      while (i < lines.length && (ordered ? isNumbered(lines[i]) : isBullet(lines[i]))) {
        const content = lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/, '');
        items.push(<li key={items.length}>{inline(content, `li${k}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(
        ordered
          ? <ol key={k++} className="list-decimal pl-5 space-y-1">{items}</ol>
          : <ul key={k++} className="list-disc pl-5 space-y-1">{items}</ul>
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s+/.test(lines[i]) && !isBullet(lines[i]) && !isNumbered(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={k++}>{inline(para.join(' '), `p${k}`)}</p>);
  }

  return <div className={`space-y-2 leading-relaxed break-words ${className || ''}`}>{blocks}</div>;
};

export default Markdown;
