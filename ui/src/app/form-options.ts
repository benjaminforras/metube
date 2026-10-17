import { Option } from './interfaces';

// A select trigger sitting inside an input group: the group draws the border.
export const GROUP_SELECT_TRIGGER_CLASS =
  'h-full w-full rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent';

// A select trigger's label function: the option's text rather than its id.
// Takes a getter so a list that changes (formats, qualities) is read fresh;
// the returned function is created once, so the select keeps one reference.
export function optionLabel(options: () => Option[] | undefined): (id: unknown) => string {
  return (id: unknown) => options()?.find(o => o.id === id)?.text ?? String(id ?? '');
}
