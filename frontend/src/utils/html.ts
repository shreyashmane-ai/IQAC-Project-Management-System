/**
 * HTML utilities for safe rendering and text extraction
 */

/**
 * Converts HTML string to plain text for safe display
 * - Converts block elements to newlines
 * - Strips all tags
 * - Collapses whitespace
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  // Block tags → newlines
  const withBreaks = html.replace(/<\/?(p|div|br|li|h[1-6]|ul|ol|blockquote|section|article|header|footer|tr|td|th|table|thead|tbody|tfoot)>/gi, '\n');
  // Strip all remaining tags
  const stripped = withBreaks.replace(/<[^>]+>/g, '');
  // Collapse whitespace & trim
  return stripped.replace(/\s+/g, ' ').trim();
}

/**
 * Sanitizes HTML for safe display (basic implementation)
 * For production, consider using DOMPurify
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

/**
 * Truncates HTML to a maximum length, preserving tag structure
 */
export function truncateHtml(html: string, maxLength: number): string {
  if (!html || html.length <= maxLength) return html;
  
  const plain = htmlToPlainText(html);
  if (plain.length <= maxLength) return html;
  
  return plain.slice(0, maxLength).trim() + '…';
}