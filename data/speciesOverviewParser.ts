/**
 * Overview parser utilities.
 *
 * Responsibility: normalize species overview content into UI-ready section/line
 * structures. This module handles plain description text parsing and structured
 * profile section normalization only.
 */
import type { SpeciesOverviewLine, SpeciesOverviewSection } from './types';

type JsonRecord = Record<string, unknown>;

const FREQUENCY_PREFIX = /^(always|almost always|primarily|often|sometimes|rarely)\s+in\s+(.+)$/i;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' ? (value as JsonRecord) : {};

const slugifySectionId = (value: string, fallback: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
};

const normalizeOverviewLine = (entry: unknown): SpeciesOverviewLine | null => {
  const source = asRecord(entry);
  const body = typeof source.body === 'string' ? source.body.trim() : '';
  if (!body.length) {
    return null;
  }

  const prefix = typeof source.prefix === 'string' ? source.prefix.trim() : '';
  return prefix.length ? { prefix, body } : { body };
};

const normalizeOverviewSection = (
  entry: unknown,
  index: number,
): SpeciesOverviewSection | null => {
  const source = asRecord(entry);
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const linesSource = Array.isArray(source.lines) ? source.lines : [];
  const lines = linesSource
    .map(normalizeOverviewLine)
    .filter((line): line is SpeciesOverviewLine => Boolean(line));

  if (!title.length || lines.length === 0) {
    return null;
  }

  const idRaw = typeof source.id === 'string' ? source.id.trim() : '';
  const fallbackId = `section-${index + 1}`;
  return {
    id: idRaw || slugifySectionId(title, fallbackId),
    title,
    lines,
  };
};

const normalizeLineBody = (value: string): SpeciesOverviewLine | null => {
  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  const freqMatch = trimmed.match(FREQUENCY_PREFIX);
  if (freqMatch) {
    const rawPrefix = freqMatch[1] ?? '';
    const body = (freqMatch[2] ?? '').trim();
    if (body.length) {
      const prefix = `${rawPrefix.charAt(0).toUpperCase()}${rawPrefix.slice(1).toLowerCase()} in:`;
      return { prefix, body };
    }
  }

  return { body: trimmed };
};

export const parseOverviewSectionsFromDescriptionText = (description: string): SpeciesOverviewSection[] => {
  const rawLines = description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rawLines.length) {
    return [];
  }

  const sections: SpeciesOverviewSection[] = [];
  rawLines.forEach((line, index) => {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (!match) {
      const normalized = normalizeLineBody(line);
      if (!normalized) {
        return;
      }
      sections.push({
        id: `section-${index + 1}`,
        title: 'Overview',
        lines: [normalized],
      });
      return;
    }

    const rawTitle = (match[1] ?? '').trim();
    const rawBody = (match[2] ?? '').trim();
    if (!rawTitle.length || !rawBody.length) {
      return;
    }

    const normalized = normalizeLineBody(rawBody);
    if (!normalized) {
      return;
    }

    sections.push({
      id: slugifySectionId(rawTitle, `section-${index + 1}`),
      title: rawTitle,
      lines: [normalized],
    });
  });

  return sections;
};

export const parseOverviewSectionsFromDetailSource = (
  detailSource: JsonRecord,
  description: string,
): SpeciesOverviewSection[] => {
  const profile = asRecord(detailSource.description_profile ?? detailSource.descriptionProfile);
  const sectionsSource = Array.isArray(profile.sections) ? profile.sections : [];
  const sections = sectionsSource
    .map(normalizeOverviewSection)
    .filter((section): section is SpeciesOverviewSection => Boolean(section));

  if (sections.length > 0) {
    return sections;
  }

  return parseOverviewSectionsFromDescriptionText(description);
};
