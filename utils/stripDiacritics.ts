export function stripDiacritics(input?: string): string {
  if (!input) return '';
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}