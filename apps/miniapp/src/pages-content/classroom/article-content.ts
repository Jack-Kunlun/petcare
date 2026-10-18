/** Fits images from the server-sanitized article HTML inside the reading column. */
export function fitArticleImages(html: string): string {
  return html.replace(/<img\b/g, '<img style="max-width:100%;height:auto;"');
}
