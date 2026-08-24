// A handful of Latin letters NFKD doesn't decompose into base + accent
// (they're distinct letters, not accented forms) but that do appear in
// Premier League player names, e.g. Martin Ødegaard.
const NON_DECOMPOSING: Record<string, string> = {
  Ø: "O",
  ø: "o",
  Đ: "D",
  đ: "d",
  Ł: "L",
  ł: "l",
};

export function slugify(input: string): string {
  const withBaseLetters = input.replace(
    /[ØøĐđŁł]/g,
    (ch) => NON_DECOMPOSING[ch] ?? ch
  );

  return withBaseLetters
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip remaining accents (e.g. "é" -> "e")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
