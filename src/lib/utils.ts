
/**
 * Tagged template literal function to strip leading indentation from multi-line strings.
 * 
 * Usage:
 *   const str = dedent`
 *     Line 1
 *     Line 2
 *   `;
 * 
 * This will produce "Line 1\nLine 2" without the leading spaces.
 */
export function dedent(strings: TemplateStringsArray, ...values: any[]) {
  // 1. Interleave strings and values
  const fullString = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '');

  // 2. Find the indentation of the first non-empty line
  //    Matches start of line, optional whitespace, then non-whitespace
  //    We only care about the whitespace part
  const match = fullString.match(/^[ \t]*(?=\S)/m);
  const indent = match ? match[0] : '';

  if (!indent) return fullString.trim();

  // 3. Create a regex to replace that specific indentation on every line
  const regex = new RegExp(`^${indent}`, 'gm');
  return fullString.replace(regex, '').trim();
}
