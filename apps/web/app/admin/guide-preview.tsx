import Image from "next/image";
import Link from "next/link";
import { GUIDE_ACTIONS } from "../guias/guide-data";

type PreviewGuide = {
  title: string;
  slug: string;
  summary: string;
  category: string;
  body: string;
  readingMinutes: number;
  coverImage: string | null;
};

function headingId(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-AO").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function inline(text: string, key: string) {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s]+|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(part);
    if (link) return <a key={`${key}-${index}`} href={link[2]}>{link[1]}</a>;
    if (/^https?:\/\//.test(part)) return <a key={`${key}-${index}`} href={part}>{part}</a>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${key}-${index}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={`${key}-${index}`}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function bodyBlocks(body: string) {
  let checklistSection = false;
  return body.trim().split(/\n\s*\n/).filter(Boolean).map((block, index) => {
    const lines = block.split("\n").filter(Boolean);
    const first = lines[0] ?? "";
    const heading = /^(#{2,3})\s+(.+)$/.exec(first);
    if (heading) {
      checklistSection = /checklist/i.test(heading[2]);
      return heading[1].length === 2
        ? <h2 id={headingId(heading[2])} key={index}>{heading[2]}</h2>
        : <h3 key={index}>{heading[2]}</h3>;
    }
    if (lines.length === 1 && /^---+$/.test(first)) return <hr key={index} />;
    const table = lines.length > 1 && lines.every((line) => /^\|.*\|$/.test(line.trim()));
    if (table) {
      const rows = lines.filter((line) => !/^\|\s*:?-{2,}/.test(line.trim())).map((line) => line.trim().slice(1, -1).split("|").map((cell) => cell.trim()));
      const [header, ...values] = rows;
      return <div className="guide-table-wrap" key={index}><table className="guide-table"><thead><tr>{header.map((cell, i) => <th key={i}>{inline(cell, `h-${index}-${i}`)}</th>)}</tr></thead><tbody>{values.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{inline(cell.replace(/\*\*/g, ""), `c-${index}-${ri}-${ci}`)}</td>)}</tr>)}</tbody></table></div>;
    }
    if (lines.every((line) => /^[-•]\s/.test(line) || /^\d+\.\s/.test(line))) {
      const ordered = lines.every((line) => /^\d+\.\s/.test(line));
      if (checklistSection && !ordered) return <div className="guide-checklist" key={index}><div className="guide-checklist-progress"><span>Checklist interactiva</span><strong>0 de {lines.length}</strong></div>{lines.map((line, i) => <label key={i}><input type="checkbox" disabled /><span>{inline(line.replace(/^(?:[-•]|\d+)\.?\s/, ""), `check-${index}-${i}`)}</span></label>)}</div>;
      const List = ordered ? "ol" : "ul";
      return <List key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^(?:[-•]|\d+)\.?\s/, ""), `li-${index}-${i}`)}</li>)}</List>;
    }
    if (first.startsWith("*") && first.endsWith("*") && lines.length === 1) return <p className="guide-editorial-note" key={index}>{inline(first, `note-${index}`)}</p>;
    return <p key={index}>{inline(lines.join(" "), `p-${index}`)}</p>;
  });
}

export function GuidePreview({ guide }: { guide: PreviewGuide }) {
  const sections = guide.body.match(/^##\s+.+$/gm)?.map((line) => line.replace(/^##\s+/, "")) ?? [];
  const action = GUIDE_ACTIONS[guide.slug];
  return <article className="guide-article admin-guide-preview">
    {guide.coverImage && <div className="guide-article-cover"><Image src={guide.coverImage} alt={`Capa: ${guide.title}`} width={1200} height={675} unoptimized={guide.coverImage.startsWith("/api/v1/")} sizes="(max-width: 900px) 100vw, 850px" /></div>}
    <p className="eyebrow">{guide.category}</p>
    <h1>{guide.title || "Título do guia"}</h1>
    <p className="guide-summary">{guide.summary || "O resumo do guia será apresentado aqui."}</p>
    <div className="guide-article-meta"><span>{guide.readingMinutes || 5} min de leitura</span><span>Pré-visualização</span></div>
    {sections.length > 2 && <nav className="guide-toc" aria-label="Neste guia"><strong>Neste guia</strong><ol>{sections.map((section) => <li key={section}><a href={`#${headingId(section)}`}>{section}</a></li>)}</ol></nav>}
    <div className="guide-body">{bodyBlocks(guide.body || "O conteúdo do guia aparecerá aqui à medida que escreveres.")}</div>
    {action && <aside className="guide-action"><div><p className="eyebrow">Continua a preparar o teu evento</p><h2>Leva este próximo passo para a prática.</h2></div><Link className="button button-primary" href={action.href}>{action.label} →</Link></aside>}
  </article>;
}
