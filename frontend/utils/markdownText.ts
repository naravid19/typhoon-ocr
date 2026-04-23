export function markdownToPlainText(markdown: string): string {
  if (!markdown) return "";

  let text = markdown.replace(/\r\n/g, "\n");

  // Keep code content but drop fenced markers.
  text = text.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (_, code: string) => code.trim());
  text = text.replace(/`([^`]+)`/g, "$1");

  // Preserve visible text while removing markdown syntax.
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  text = text.replace(/^\s{0,3}>\s?/gm, "");
  text = text.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  text = text.replace(/^\s*([-*_]){3,}\s*$/gm, "");

  // Flatten markdown tables to tab-separated text.
  text = text.replace(/^\|?[\s:-]+\|[\s|:-]*$/gm, "");
  text = text.replace(/^\s*\|/gm, "");
  text = text.replace(/\|\s*$/gm, "");
  text = text.replace(/\s*\|\s*/g, "\t");

  // Strip emphasis markers.
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");

  // Drop HTML tags that may appear in structure/v1.5 outputs.
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|li|tr|h[1-6]|table|blockquote)>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");

  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
