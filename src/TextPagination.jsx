import React from "react";

// Adapted from murad-sinatra's 21st.dev compact Pagination (demo 43544).
export default function TextPagination({ page, pageCount, onPageChange }) {
  const pages = pageCount <= 7 ? Array.from({ length: pageCount }, (_, i) => i + 1) : [1, ...(page > 3 ? ["left"] : []), ...Array.from({ length: Math.min(pageCount - 1, page + 1) - Math.max(2, page - 1) + 1 }, (_, i) => Math.max(2, page - 1) + i), ...(page < pageCount - 2 ? ["right"] : []), pageCount];
  const style = "rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold disabled:opacity-40";
  return <nav aria-label="Text library pages" className="mt-4 flex flex-wrap items-center gap-1">
    <button type="button" className={style} disabled={page === 1} onClick={() => onPageChange(page - 1)}>Previous</button>
    {pages.map((item) => typeof item === "string" ? <span key={item} aria-hidden="true" className="px-1">…</span> : <button type="button" key={item} aria-label={`Page ${item}`} aria-current={item === page ? "page" : undefined} onClick={() => onPageChange(item)} className={`${style} ${item === page ? "bg-[#176c5f] text-white" : "bg-white text-[#374151]"}`}>{item}</button>)}
    <button type="button" className={style} disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>Next</button>
  </nav>;
}
