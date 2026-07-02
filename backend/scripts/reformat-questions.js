/**
 * One-time script: reformats existing questions into clean markdown via Gemini
 * WITHOUT changing their meaning (title casing, paragraphs, code fences).
 *
 * Safety model:
 *   - Default is a DRY RUN: prints before/after, writes nothing.
 *   - `--apply` first copies the original rows into `questions_format_backup`,
 *     then updates `questions`.
 *   - Guards: skips a question if Gemini's output is empty, too short for the
 *     schema CHECKs (title >= 5, content >= 10), or suspiciously long (> 2.5x).
 *
 * After a successful --apply, RE-EMBED so semantic search matches the new text:
 *   node scripts/reembed-questions.js
 *
 * Run from the backend/ directory:
 *   node scripts/reformat-questions.js            # dry run
 *   node scripts/reformat-questions.js --apply    # write changes
 */
import { safeExecute } from "../db/config.js";
import { GoogleGenAI } from "@google/genai";

const APPLY = process.argv.includes("--apply");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set — aborting.");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const PROMPT = `You are REPAIRING the markdown of a technical forum question that was saved
through a broken editor. The author already wrote markdown — fix what is malformed so it
renders correctly. Do not restyle what already works.

Rules:
- Multi-line code wrapped in single backticks -> proper fenced code blocks with a language tag.
- Un-fenced code, commands, or error/stack-trace text -> fenced code blocks.
- Broken/unclosed markdown syntax -> repaired.
- Keep the author's existing paragraphs, bold/italics, and wording as-is.
- Title: keep it in the author's sentence case. Only remove obvious pasted junk
  (e.g. task-description prefixes) or fix typos. Do NOT convert to Title Case.
- Do NOT add information, remove information, change meaning, or answer the question.
- Keep roughly the same length. If nothing is malformed, return the input unchanged.

Return ONLY valid JSON: {"title": "...", "content": "..."}`;

const reformat = async (title, content) => {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `${PROMPT}\n\nTitle: ${title}\n\nContent:\n${content}`,
    config: { responseMimeType: "application/json" },
  });
  return JSON.parse(response.text || "{}");
};

const acceptable = (oldText, newText, min, max) =>
  typeof newText === "string" &&
  newText.trim().length >= min &&
  newText.length <= max &&
  newText.length <= Math.max(oldText.length * 2.5, min + 200);

async function main() {
  const rows = await safeExecute(
    `SELECT question_id, title, content FROM questions ORDER BY question_id`,
    [],
  );
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${rows.length} question(s)\n`);

  if (APPLY) {
    await safeExecute(
      `CREATE TABLE IF NOT EXISTS questions_format_backup (
         question_id INT PRIMARY KEY,
         title VARCHAR(255) NOT NULL,
         content TEXT NOT NULL,
         backed_up_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      [],
    );
  }

  let changed = 0;
  let skipped = 0;
  for (const row of rows) {
    let out;
    try {
      out = await reformat(row.title, row.content);
    } catch (err) {
      console.log(`#${row.question_id} SKIP (Gemini error: ${err.message})`);
      skipped++;
      continue;
    }
    const okTitle = acceptable(row.title, out.title, 5, 255);
    const okContent = acceptable(row.content, out.content, 10, 60000);
    if (!okTitle || !okContent) {
      console.log(`#${row.question_id} SKIP (guard failed: title=${okTitle} content=${okContent})`);
      skipped++;
      continue;
    }
    const same = out.title === row.title && out.content === row.content;
    console.log(`#${row.question_id} ${same ? "UNCHANGED" : "REFORMAT"}`);
    if (!same) {
      console.log(`  OLD TITLE: ${row.title}`);
      console.log(`  NEW TITLE: ${out.title}`);
      console.log(`  OLD: ${JSON.stringify(row.content.slice(0, 160))}`);
      console.log(`  NEW: ${JSON.stringify(out.content.slice(0, 160))}\n`);
    }
    if (APPLY && !same) {
      await safeExecute(
        `INSERT IGNORE INTO questions_format_backup (question_id, title, content) VALUES (?, ?, ?)`,
        [row.question_id, row.title, row.content],
      );
      await safeExecute(
        `UPDATE questions SET title = ?, content = ? WHERE question_id = ?`,
        [out.title, out.content, row.question_id],
      );
      changed++;
    }
  }

  console.log(`\nDone. ${APPLY ? `${changed} updated` : "no writes (dry run)"}${skipped ? `, ${skipped} skipped` : ""}.`);
  if (APPLY && changed > 0) {
    console.log("NEXT: re-embed so search matches the new text ->  node scripts/reembed-questions.js");
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
