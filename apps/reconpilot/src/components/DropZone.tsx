import { useRef, useState } from "react";
import type { ParsedFile } from "../recon/parse";

const FIELD_LABEL: Record<string, string> = { date: "date", ref: "reference", description: "description", amount: "amount" };

interface Props {
  step: number;
  title: string;
  hint: string;
  testid: string;
  file?: { name: string; parsed: ParsedFile };
  onFile: (file: File) => void;
}

export function DropZone({ step, title, hint, testid, file, onFile }: Props) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = `file-${testid}`;

  return (
    <div
      className={`drop ${file ? "is-loaded" : ""} ${over ? "is-over" : ""}`}
      data-testid={testid}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <div className="drop-head">
        <span className="step" aria-hidden>{file ? "✓" : step}</span>
        <label htmlFor={id} className="drop-title">{title}</label>
      </div>

      {file ? (
        <div className="drop-body">
          <div className="file-line">
            <span className="file-name">{file.parsed.missing.length ? "⚠ " : ""}{file.name}</span>
            <span className="file-rows">{file.parsed.txns.length} rows</span>
          </div>
          <ul className="mapping" aria-label="Detected columns">
            {Object.entries(file.parsed.columns).map(([field, header]) => (
              <li key={field} className={header ? "" : "missing"}>
                <span className="src">{header ?? "not found"}</span>
                <span className="arrow" aria-hidden>→</span>
                <span className="dst">{FIELD_LABEL[field]}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="text-btn" onClick={() => input.current?.click()}>Replace file</button>
        </div>
      ) : (
        <button type="button" className="drop-empty" onClick={() => input.current?.click()}>
          <span>{hint}</span>
          <span className="drop-cta">Drop a CSV here or <u>browse</u></span>
        </button>
      )}

      <input
        ref={input}
        id={id}
        type="file"
        accept=".csv,text/csv"
        className="visually-hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
