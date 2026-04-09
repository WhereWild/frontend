import type JSZip from 'jszip';
import { resolveParquetEntryPaths } from '@/data/uploadZipParquetParser';

describe('resolveParquetEntryPaths', () => {
  it('accepts zip bundles that omit variable_metadata.parquet', () => {
    const zip = {
      files: {
        'categorical_stats.parquet': { dir: false },
        'categorical_value_lookup.parquet': { dir: false },
        'density_graph.parquet': { dir: false },
        'occurrence.parquet': { dir: false },
        'occurrence_index.parquet': { dir: false },
        'summary_stats.parquet': { dir: false },
      },
    } as unknown as JSZip;

    const entryPaths = resolveParquetEntryPaths(zip);

    expect(entryPaths).toEqual(
      expect.objectContaining({
        categoricalStats: 'categorical_stats.parquet',
        categoricalValueLookup: 'categorical_value_lookup.parquet',
        densityGraph: 'density_graph.parquet',
        occurrences: 'occurrence.parquet',
        occurrenceIndex: 'occurrence_index.parquet',
        summaryStats: 'summary_stats.parquet',
      }),
    );
    expect(entryPaths.variableMetadata).toBeUndefined();
  });

  it('accepts categorical_value_lookup.csv as the bridge table entry', () => {
    const zip = {
      files: {
        'categorical_stats.parquet': { dir: false },
        'categorical_value_lookup.csv': { dir: false },
        'density_graph.parquet': { dir: false },
        'occurrence.parquet': { dir: false },
        'occurrence_index.parquet': { dir: false },
        'summary_stats.parquet': { dir: false },
      },
    } as unknown as JSZip;

    expect(resolveParquetEntryPaths(zip)).toEqual(
      expect.objectContaining({
        categoricalValueLookup: 'categorical_value_lookup.csv',
      }),
    );
  });
});