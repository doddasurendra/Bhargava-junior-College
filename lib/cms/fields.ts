/**
 * A tiny form description for CMS blocks, so the admin editor can render any block (scalars, lists of rows,
 * string lists, groups) without a custom screen per block. Validation is the block's zod schema.
 */
export type Field =
  | { key: string; label: string; type: 'text' | 'longtext' | 'url' | 'date' | 'time'; help?: string }
  | { key: string; label: string; type: 'number'; help?: string; min?: number; max?: number }
  | { key: string; label: string; type: 'bool'; help?: string }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; help?: string }
  | { key: string; label: string; type: 'strings'; help?: string }
  | { key: string; label: string; type: 'list'; of: Field[]; help?: string; itemLabel?: string }
  | { key: string; label: string; type: 'group'; fields: Field[]; help?: string };

/** An empty value for a field, used when the editor adds a row. */
export function blank(f: Field): unknown {
  switch (f.type) {
    case 'number':
      return 0;
    case 'bool':
      return false;
    case 'strings':
    case 'list':
      return [];
    case 'group':
      return Object.fromEntries(f.fields.map((x) => [x.key, blank(x)]));
    case 'select':
      return f.options[0]?.value ?? '';
    default:
      return '';
  }
}
