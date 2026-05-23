import JSZip from 'jszip';
import type { DataSource } from '@/data/types';
import { readBlobAsArrayBuffer } from '../utils/blob';
import type {
  RawCategoricalStatsRow,
  RawCategoricalValueLookupRow,
  RawDensityGraphRow,
  RawOccurrenceIndexRow,
  RawOccurrenceRow,
  RawSummaryStatsRow,
  RawUploadedParquetBundle,
  RawVariableMetadataRow,
} from '@/data/uploadLocalSpeciesDataSource';

type AsyncBufferLike = {
  byteLength: number;
  slice(start: number, end?: number): Promise<ArrayBuffer>;
};

type UploadParquetTableKey =
  | 'categoricalStats'
  | 'categoricalValueLookup'
  | 'densityGraph'
  | 'occurrences'
  | 'occurrenceIndex'
  | 'summaryStats'
  | 'variableMetadata';

type ZipTableMatchConfig = {
  key: UploadParquetTableKey;
  aliases: string[];
  required?: boolean;
};

const buildTableAliases = (...aliases: string[]) => {
  return aliases.flatMap((alias) => {
    const normalizedAlias = alias.trim().toLowerCase();
    if (
      normalizedAlias.endsWith('.parquet') ||
      normalizedAlias.endsWith('.csv')
    ) {
      return [normalizedAlias, normalizedAlias.replace(/\.(parquet|csv)$/, '')];
    }

    return [
      normalizedAlias,
      `${normalizedAlias}.parquet`,
      `${normalizedAlias}.csv`,
    ];
  });
};

const UPLOAD_TABLES: ZipTableMatchConfig[] = [
  {
    key: 'categoricalStats',
    aliases: buildTableAliases('nominal_stats', 'categorical_stats'),
    required: true,
  },
  {
    key: 'categoricalValueLookup',
    aliases: buildTableAliases('categorical_value_lookup'),
  },
  {
    key: 'densityGraph',
    aliases: buildTableAliases('numerical_density', 'density_graph', 'desntiy_graph'),
    required: true,
  },
  {
    key: 'occurrences',
    aliases: buildTableAliases('occurrence', 'occurrences'),
    required: true,
  },
  {
    key: 'occurrenceIndex',
    aliases: buildTableAliases('occurrence_index'),
    required: true,
  },
  {
    key: 'summaryStats',
    aliases: buildTableAliases('numerical_stats', 'summary_stats'),
    required: true,
  },
  {
    key: 'variableMetadata',
    aliases: buildTableAliases('variable_metadata'),
  },
];

const normalizeBasename = (path: string) => {
  const basename = path.split('/').pop() ?? path;
  return basename.trim().toLowerCase();
};

const isMatchingTable = (basename: string, aliases: string[]) => {
  const normalized = basename.toLowerCase();
  return aliases.some((alias) => normalized === alias);
};

const toTypedRows = <TRow extends Record<string, unknown>>(
  rows: Record<string, unknown>[],
) => {
  return rows as TRow[];
};

const asyncBufferFromArrayBuffer = (buffer: ArrayBuffer): AsyncBufferLike => ({
  byteLength: buffer.byteLength,
  slice(start: number, end?: number) {
    return Promise.resolve(buffer.slice(start, end));
  },
});

const parseParquetEntryRows = async (filePath: string, buffer: ArrayBuffer) => {
  const { parquetReadObjects } = await import('hyparquet/src/index.js');

  return parquetReadObjects({
    file: asyncBufferFromArrayBuffer(buffer),
  });
};

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
};

const parseCsvEntryRows = (buffer: ArrayBuffer) => {
  const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index];
    const next = normalizedText[index + 1];

    if (char === '"') {
      currentLine += char;
      if (inQuotes && next === '"') {
        currentLine += next;
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === '\n' && !inQuotes) {
      lines.push(currentLine);
      currentLine = '';
      continue;
    }

    currentLine += char;
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  const nonEmptyLines = lines.filter(
    (line, index) => index === 0 || line.trim().length > 0,
  );
  const [headerLine, ...rowLines] = nonEmptyLines;
  if (!headerLine) {
    return [] as Record<string, unknown>[];
  }

  const headers = parseCsvLine(headerLine);
  return rowLines.map<Record<string, unknown>>((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, unknown>>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
};

const parseZipEntryRows = async (filePath: string, buffer: ArrayBuffer) => {
  if (filePath.trim().toLowerCase().endsWith('.csv')) {
    return parseCsvEntryRows(buffer);
  }

  return parseParquetEntryRows(filePath, buffer);
};

export class UploadZipParseError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super(`Failed to parse upload zip: ${issues.join(' | ')}`);
    this.name = 'UploadZipParseError';
    this.issues = issues;
  }
}

export const resolveParquetEntryPaths = (zip: JSZip) => {
  const zipEntries = Object.keys(zip.files)
    .filter((path) => !zip.files[path].dir)
    .map((path) => ({
      path,
      basename: normalizeBasename(path),
    }));

  const matched: Partial<Record<UploadParquetTableKey, string>> = {};

  for (const table of UPLOAD_TABLES) {
    const found = zipEntries.find((entry) =>
      isMatchingTable(entry.basename, table.aliases),
    );
    if (found) {
      matched[table.key] = found.path;
    }
  }

  const missing = UPLOAD_TABLES.filter(
    (table) => table.required && !matched[table.key],
  ).map((table) => table.aliases[0]);

  if (missing.length) {
    throw new UploadZipParseError([
      `Missing required parquet file(s): ${missing.join(', ')}`,
    ]);
  }

  return matched;
};

export const parseUploadedParquetZipToRawBundle = async (
  zipFile: Blob,
): Promise<RawUploadedParquetBundle> => {
  const zip = await JSZip.loadAsync(
    await readBlobAsArrayBuffer(zipFile, {
      unavailableMessage: 'Uploaded ZIP could not be read on this device.',
      readErrorMessage: 'Failed to read uploaded ZIP blob.',
      invalidResultMessage: 'Uploaded ZIP blob did not resolve to binary data.',
    }),
  );
  const entryPaths = resolveParquetEntryPaths(zip);

  const issues: string[] = [];

  const readTable = async (key: UploadParquetTableKey) => {
    const path = entryPaths[key];
    if (!path) {
      return [];
    }

    const entry = zip.file(path);
    if (!entry) {
      throw new UploadZipParseError([`Could not read zip entry: ${path}`]);
    }

    try {
      const buffer = await entry.async('arraybuffer');
      return await parseZipEntryRows(path, buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(`${path}: ${message}`);
      return [];
    }
  };

  const readDataSourcesJson = async (): Promise<
    Record<string, DataSource> | undefined
  > => {
    const entry = zip.file('data_sources.json');
    if (!entry) return undefined;
    try {
      const text = await entry.async('string');
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, DataSource>;
      }
    } catch {
      // Ignore malformed data_sources.json
    }
    return undefined;
  };

  const [
    categoricalStatsRows,
    categoricalValueLookupRows,
    densityGraphRows,
    occurrenceRows,
    occurrenceIndexRows,
    summaryStatsRows,
    variableMetadataRows,
    dataSources,
  ] = await Promise.all([
    readTable('categoricalStats'),
    readTable('categoricalValueLookup'),
    readTable('densityGraph'),
    readTable('occurrences'),
    readTable('occurrenceIndex'),
    readTable('summaryStats'),
    readTable('variableMetadata'),
    readDataSourcesJson(),
  ]);

  if (issues.length) {
    throw new UploadZipParseError(issues);
  }

  return {
    categoricalStats: toTypedRows<RawCategoricalStatsRow>(categoricalStatsRows),
    categoricalValueLookup: toTypedRows<RawCategoricalValueLookupRow>(
      categoricalValueLookupRows,
    ),
    densityGraph: toTypedRows<RawDensityGraphRow>(densityGraphRows),
    occurrences: toTypedRows<RawOccurrenceRow>(occurrenceRows),
    occurrenceIndex: toTypedRows<RawOccurrenceIndexRow>(occurrenceIndexRows),
    summaryStats: toTypedRows<RawSummaryStatsRow>(summaryStatsRows),
    variableMetadata: toTypedRows<RawVariableMetadataRow>(variableMetadataRows),
    dataSources,
    meta: {
      source: 'upload-local',
      uploadedAt: new Date().toISOString(),
    },
  };
};
