import {
  buildTaxaQuerySearchParams,
  type TaxaQueryParams,
} from '@/data/apiTaxaQueryHelpers';
import type { TaxaQueryResponse } from '@/data/types';

const SEARCH_SESSION_CACHE_LIMIT = 50;

const taxaQuerySessionCache = new Map<string, TaxaQueryResponse>();

export const resetTaxaQuerySessionCache = () => {
  taxaQuerySessionCache.clear();
};

export const buildTaxaQueryCacheKey = (params: TaxaQueryParams) =>
  buildTaxaQuerySearchParams(params).toString();

export const readCachedTaxaQuery = (key: string) => {
  const cached = taxaQuerySessionCache.get(key);
  if (!cached) {
    return null;
  }

  taxaQuerySessionCache.delete(key);
  taxaQuerySessionCache.set(key, cached);
  return cached;
};

export const writeCachedTaxaQuery = (
  key: string,
  payload: TaxaQueryResponse,
) => {
  if (taxaQuerySessionCache.has(key)) {
    taxaQuerySessionCache.delete(key);
  }

  taxaQuerySessionCache.set(key, payload);
  while (taxaQuerySessionCache.size > SEARCH_SESSION_CACHE_LIMIT) {
    const oldestKey = taxaQuerySessionCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    taxaQuerySessionCache.delete(oldestKey);
  }
};