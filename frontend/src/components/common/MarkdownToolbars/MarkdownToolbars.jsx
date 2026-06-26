import { Bold, Italic, Code2, Link2 } from "lucide-react";
import styles from "./MarkdownToolbars.module.css";

const MarkdownToolbar = ({
  textareaRef,
  value,
  onChange,
  disabled = false,
  hasError = false,
  children,
}) => {
  const applyFormat = (type) => {
    const textarea = textareaRef.current;
    if (!textarea || disabled || textarea.disabled) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const before = value.substring(0, start);
    const after = value.substring(end);

    const leadingWs = selected.match(/^(\s*)/)[1];
    const trailingWs = selected.match(/(\s*)$/)[1];
    const trimmed = selected.slice(
      leadingWs.length,
      selected.length - trailingWs.length
    );

    let formatted = "";

    switch (type) {
      case "bold":
        formatted = `${leadingWs}**${trimmed || "bold text"}**${trailingWs}`;
        break;
      case "italic":
        formatted = `${leadingWs}*${trimmed || "italic text"}*${trailingWs}`;
        break;
      case "code":
        formatted = trimmed.includes("\n")
          ? `\`\`\`\n${trimmed || "code here"}\n\`\`\``
          : `${leadingWs}\`${trimmed || "code"}\`${trailingWs}`;
        break;
      case "link":
        formatted = `${leadingWs}[${trimmed || "link text"}](url)${trailingWs}`;
        break;
      default:
        return;
    }

    const newText = before + formatted + after;
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursor = start + formatted.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  return (
    <div
      className={`${styles.editorWrapper}${hasError ? ` ${styles.editorWrapperError}` : ""}`}
    >
      <div className={styles.toolbar}>
        <div className={styles.toolbarButtons}>
          <button
            type="button"
            className={styles.toolbarBtn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("bold")}
            aria-label="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            className={`${styles.toolbarBtn} ${styles.toolbarBtnItalic}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("italic")}
            aria-label="Italic"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            className={`${styles.toolbarBtn} ${styles.toolbarBtnCode}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("code")}
            aria-label="Code"
          >
            <Code2 size={14} />
          </button>
          <button
            type="button"
            className={`${styles.toolbarBtn} ${styles.toolbarBtnLink}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("link")}
            aria-label="Link"
          >
            <Link2 size={14} />
          </button>
        </div>
        <span className={styles.charCount}>{value.length} characters</span>
      </div>

      {children}
    </div>
  );
};

export default MarkdownToolbar;
