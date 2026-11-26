/** The fewest rows a scrolling list shrinks to in a small window. */
export const minListRows = 5;

/**
 * A page whose list is as long as fits in `height` lines (the fill-terminal
 * design: lists grow into a tall window and shrink in a small one). `render`
 * draws the page with its list `rows` long; `base` is the list's default.
 * The page is drawn at `base`, the list given the difference, then trimmed
 * while it's still too tall (headings inside a list can make it grow faster
 * than one line a row), never below `floor`. With no height it's drawn at `base`.
 */
export function fitRows(render: (rows: number) => string, base: number, height: number, floor = minListRows): { screen: string; rows: number } {
  const lines = (s: string) => s.split('\n').length;
  if (height <= 0) return { screen: render(base), rows: base };
  let n = Math.max(floor, base + height - lines(render(base)));
  let screen = render(n);
  while (lines(screen) > height && n > floor) {
    n = Math.max(floor, n - Math.max(1, lines(screen) - height));
    screen = render(n);
  }
  return { screen, rows: n };
}
