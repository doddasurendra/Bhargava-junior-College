'use client';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary">
      Print / save as PDF
    </button>
  );
}
