import Button from "@/components/common/Button";
import { useToast } from "@/hooks/useToast";

const CODE_39: Record<string, string> = {
  "-": "nwnnnnwnw",
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "*": "nwnnwnwnn",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function code39Svg(value: string): string | null {
  const text = value.toUpperCase();
  if (!text || [...text].some((character) => !CODE_39[character])) return null;
  const encoded = `*${text}*`;
  const narrow = 2;
  const wide = narrow * 3;
  const height = 54;
  let x = 10;
  const bars: string[] = [];
  for (const character of encoded) {
    const pattern = CODE_39[character];
    for (let index = 0; index < pattern.length; index += 1) {
      const width = pattern[index] === "w" ? wide : narrow;
      if (index % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${width}" height="${height}"/>`);
      x += width;
    }
    x += narrow;
  }
  const width = x + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Code 39 barcode ${escapeHtml(value)}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/>${bars.join("")}</svg>`;
}

interface BarcodeLabelButtonProps {
  barcode: string;
  bookTitle?: string;
}

export default function BarcodeLabelButton({ barcode, bookTitle = "PRESTAR library copy" }: BarcodeLabelButtonProps) {
  const toast = useToast();

  const printLabel = () => {
    const svg = code39Svg(barcode);
    if (!svg) {
      toast.error(`Barcode "${barcode}" contains characters not supported by the label format.`);
      return;
    }
    const printWindow = window.open("", "_blank", "width=420,height=260");
    if (!printWindow) {
      toast.error("Allow pop-ups to print this barcode label.");
      return;
    }
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><title>Barcode label</title><style>@page{size:60mm 35mm;margin:3mm}*{box-sizing:border-box}body{font:10pt Arial,sans-serif;text-align:center;margin:0;padding:3mm;color:#111}.title{font-weight:700;margin:0 0 2mm}.barcode{display:block;margin:0 auto;max-width:100%;height:16mm}.value{font-family:monospace;font-size:10pt;letter-spacing:1px;margin:1mm 0 0}</style></head><body><p class="title">${escapeHtml(bookTitle)}</p><div class="barcode">${svg}</div><p class="value">${escapeHtml(barcode)}</p></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return <Button variant="ghost" size="sm" onClick={printLabel}>Print label</Button>;
}
