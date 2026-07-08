export type SheetTab = {
  id: string;
  name: string;
  columns: string[];
  rows: string[][];
};

export type Workbook = {
  tabs: SheetTab[];
};

export function newTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyTab(name: string, columnCount = 4, rowCount = 6): SheetTab {
  return {
    id: newTabId(),
    name,
    columns: Array.from({ length: columnCount }, (_, i) => `Coluna ${i + 1}`),
    rows: Array.from({ length: rowCount }, () => Array(columnCount).fill("")),
  };
}
