/**
 * Serialize structured data for an HTML script element.
 *
 * JSON itself permits literal "<" characters and JavaScript line separators,
 * but those values can terminate or corrupt an inline script in HTML. Escaping
 * them keeps CMS-authored text inside the JSON-LD data block.
 */
export function serializeJsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
