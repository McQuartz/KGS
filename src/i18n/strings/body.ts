// Strings for the "body" area. English is the source of truth; German may lag (falls back to EN).
export const en = {
  'body.title': 'Log',
  'body.last': 'Last',
  'body.trend': 'Trend',
  'body.notePlaceholder': 'Note (optional)',
  'body.recent': 'Recent entries',
  'body.noEntries': 'No entries yet.',
  'body.outlier': 'Outlier',
  'body.deleteTitle': 'Delete entry?',
  'body.deleteMsg': '{value} on {date} will be removed.',
  'body.hold': 'Press and hold an entry to delete it.',
  'body.inputHint': 'Input method is set globally in Settings. Prefilled with your last value.',
  'body.prevDay': 'Previous day',
  'body.nextDay': 'Next day',
} as const;

export const de: Partial<Record<keyof typeof en, string>> = {
  'body.title': 'Eintragen',
  'body.last': 'Zuletzt',
  'body.trend': 'Trend',
  'body.notePlaceholder': 'Notiz (optional)',
  'body.recent': 'Letzte Einträge',
  'body.noEntries': 'Noch keine Einträge.',
  'body.outlier': 'Ausreißer',
  'body.deleteTitle': 'Eintrag löschen?',
  'body.deleteMsg': '{value} am {date} wird entfernt.',
  'body.hold': 'Eintrag gedrückt halten zum Löschen.',
  'body.inputHint': 'Die Eingabeart wählst du global in den Einstellungen. Vorbelegt mit deinem letzten Wert.',
  'body.prevDay': 'Vorheriger Tag',
  'body.nextDay': 'Nächster Tag',
};
