/** Route params for the root stack. Tabs live under "Tabs". */
export type RootStackParamList = {
  Tabs: undefined;
  ItemDetail: { id: string };
  EditItem: { id: string };
  Calculator: { itemId?: string; initial?: number } | undefined;
  Notes: { itemId?: string } | undefined;
  NoteEditor: { noteId?: string; itemId?: string };
  Contacts: undefined;
  Currency: undefined;
  Theme: undefined;
  Paywall: undefined;
  Calendar: undefined;
  Balances: undefined;
  Gateway: undefined;
  Login: undefined;
  Signup: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Add: { mode?: 'known' | 'custom' | 'csv' } | undefined;
  Optimizer: undefined;
  Inspect: undefined;
  Settings: undefined;
};
