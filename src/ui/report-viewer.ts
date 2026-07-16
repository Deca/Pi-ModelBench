import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Markdown, matchesKey, truncateToWidth, type Component } from "@earendil-works/pi-tui";

export class ReportViewer implements Component {
  private readonly markdown: Markdown;
  private scrollOffset = 0;
  private readonly visibleContentLines = 18;

  public constructor(
    private readonly title: string,
    text: string,
    private readonly requestRender: () => void,
    private readonly close: () => void,
  ) {
    this.markdown = new Markdown(text, 0, 0, getMarkdownTheme());
  }

  public handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
      this.close();
      return;
    }

    if (matchesKey(data, "up")) this.scrollOffset = Math.max(0, this.scrollOffset - 1);
    else if (matchesKey(data, "down")) this.scrollOffset += 1;
    else if (matchesKey(data, "home")) this.scrollOffset = 0;
    else if (matchesKey(data, "end")) this.scrollOffset = Number.MAX_SAFE_INTEGER;
    else return;
    this.requestRender();
  }

  public render(width: number): string[] {
    const safeWidth = Math.max(1, width);
    const contentLines = this.markdown.render(safeWidth);
    const maxOffset = Math.max(0, contentLines.length - this.visibleContentLines);
    this.scrollOffset = Math.min(this.scrollOffset, maxOffset);
    const visibleLines = contentLines.slice(this.scrollOffset, this.scrollOffset + this.visibleContentLines);
    const scroll = `↑${this.scrollOffset} ↓${Math.max(0, maxOffset - this.scrollOffset)}`;
    return [
      truncateToWidth(`${this.title}  ${scroll}`, safeWidth),
      ...visibleLines,
      ...Array.from({ length: Math.max(0, this.visibleContentLines - visibleLines.length) }, () => ""),
      truncateToWidth("↑↓ scroll • Home/End jump • Esc close", safeWidth),
    ];
  }

  public invalidate(): void {
    this.markdown.invalidate();
  }
}
