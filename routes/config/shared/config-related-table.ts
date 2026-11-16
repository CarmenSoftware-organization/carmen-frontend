// Stack detail-table cells by their own box width; retain the existing search and table semantics.
export const CONFIG_RELATED_TABLE =
  "@container [&>div:first-child]:max-w-full @max-2xl:[&_table]:block @max-2xl:[&_thead]:sr-only @max-2xl:[&_tbody]:block @max-2xl:[&_tr]:block @max-2xl:[&_td]:block @max-2xl:[&_td]:w-auto @max-2xl:[&_td:first-child:not([colspan])]:hidden @max-2xl:[&_td]:py-1.5 @max-2xl:[&_td]:break-words";
