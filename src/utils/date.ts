/**
 * Utilitare pentru gestionarea datelor calendaristice în format 'YYYY-MM-DD',
 * bazate pe timpul local al utilizatorului (pentru a evita decupajele UTC la miezul nopții).
 */

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

export function formatDisplayDate(dateStr: string): string {
  const today = getLocalDateString();
  const yesterday = shiftDate(today, -1);
  const tomorrow = shiftDate(today, 1);

  if (dateStr === today) return 'Astăzi';
  if (dateStr === yesterday) return 'Ieri';
  if (dateStr === tomorrow) return 'Mâine';

  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  return date.toLocaleDateString('ro-RO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}
