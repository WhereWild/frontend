// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import Constants from 'expo-constants';
import Head from 'expo-router/head';
import React from 'react';
import { Platform, type ImageSourcePropType } from 'react-native';

export const DEFAULT_SITE_URL = 'https://wherewild.net';
export const DEFAULT_METADATA_DESCRIPTION =
  'Explore species data, habitat context, and prediction-driven maps with WhereWild.';

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const getWindowOrigin = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const origin = window.location?.origin;
  return typeof origin === 'string' && isAbsoluteUrl(origin)
    ? origin
    : undefined;
};

export const normalizeMetadataPath = (path = '/') =>
  path.startsWith('/') ? path : `/${path}`;

const getRuntimeConfigValue = (key: 'appVariant' | 'siteUrl') =>
  Constants.expoConfig?.extra?.[key];

export const resolveMetadataOrigin = (origin?: string) => {
  if (typeof origin === 'string' && isAbsoluteUrl(origin)) {
    return origin;
  }

  const configuredSiteUrl = getRuntimeConfigValue('siteUrl');

  const windowOrigin = Platform.OS === 'web' ? getWindowOrigin() : undefined;
  if (windowOrigin) {
    return windowOrigin;
  }

  if (
    typeof configuredSiteUrl === 'string' &&
    isAbsoluteUrl(configuredSiteUrl)
  ) {
    return configuredSiteUrl;
  }

  return DEFAULT_SITE_URL;
};

export const resolveWebMetadataOrigin = (origin?: string) => {
  if (typeof origin === 'string' && isAbsoluteUrl(origin)) {
    return origin;
  }

  const windowOrigin = Platform.OS === 'web' ? getWindowOrigin() : undefined;
  if (windowOrigin) {
    return windowOrigin;
  }

  const configuredSiteUrl = getRuntimeConfigValue('siteUrl');
  if (
    typeof configuredSiteUrl === 'string' &&
    isAbsoluteUrl(configuredSiteUrl)
  ) {
    return configuredSiteUrl;
  }

  return undefined;
};

export const shouldAddNoIndexMeta = (appVariant?: string) => {
  const resolvedVariant = appVariant ?? getRuntimeConfigValue('appVariant');
  return resolvedVariant === 'development' || resolvedVariant === 'preview';
};

export const buildAbsoluteUrl = (path = '/', origin = DEFAULT_SITE_URL) =>
  new URL(normalizeMetadataPath(path), origin).toString();

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const resolveOpenGraphImageUrl = (
  imageSource?: ImageSourcePropType,
  origin?: string,
): string | undefined => {
  if (!imageSource) {
    return undefined;
  }


  if (typeof imageSource === 'object' && 'uri' in imageSource) {
    const { uri } = imageSource as { uri?: string };
    if (typeof uri === 'string' && isAbsoluteUrl(uri)) {
      return uri;
    }

    if (typeof uri === 'string' && uri.startsWith('/')) {
      return buildAbsoluteUrl(uri, resolveMetadataOrigin(origin));
    }
  }

  return undefined;
};

export type MetadataDocument = {
  title: string;
  description?: string;
  path?: string;
  imageUrl?: string;
  type?: 'website' | 'article';
  siteName?: string;
  origin?: string;
  noindex?: boolean;
};

export const buildMetadataDocument = ({
  title,
  description = DEFAULT_METADATA_DESCRIPTION,
  path = '/',
  imageUrl,
  type = 'website',
  siteName = 'WhereWild',
  origin,
  noindex = shouldAddNoIndexMeta(),
}: MetadataDocument) => {
  const resolvedOrigin = resolveMetadataOrigin(origin);
  const absoluteUrl = buildAbsoluteUrl(path, resolvedOrigin);
  const twitterCard = imageUrl ? 'summary_large_image' : 'summary';

  return {
    absoluteUrl,
    description,
    imageUrl,
    noindex,
    siteName,
    title,
    twitterCard,
    type,
  };
};

export const renderMetadataHtmlDocument = (document: MetadataDocument) => {
  const {
    absoluteUrl,
    description,
    imageUrl,
    noindex,
    siteName,
    title,
    twitterCard,
    type,
  } = buildMetadataDocument(document);

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charSet="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${escapeHtml(title)}</title>`,
    `  <meta name="description" content="${escapeHtml(description)}" />`,
    `  <link rel="canonical" href="${escapeHtml(absoluteUrl)}" />`,
    `  <meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    `  <meta property="og:type" content="${escapeHtml(type)}" />`,
    `  <meta property="og:title" content="${escapeHtml(title)}" />`,
    `  <meta property="og:description" content="${escapeHtml(description)}" />`,
    `  <meta property="og:url" content="${escapeHtml(absoluteUrl)}" />`,
    imageUrl
      ? `  <meta property="og:image" content="${escapeHtml(imageUrl)}" />`
      : '',
    noindex ? '  <meta name="robots" content="noindex, nofollow" />' : '',
    `  <meta name="twitter:card" content="${escapeHtml(twitterCard)}" />`,
    `  <meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `  <meta name="twitter:description" content="${escapeHtml(description)}" />`,
    imageUrl
      ? `  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`
      : '',
    '</head>',
    '<body>',
    '</body>',
    '</html>',
  ]
    .filter(Boolean)
    .join('\n');
};

type WebMetadataProps = {
  title: string;
  description?: string;
  path?: string;
  imageUrl?: string;
  type?: 'website' | 'article';
  origin?: string;
  noindex?: boolean;
};

export function WebMetadata({
  title,
  description = DEFAULT_METADATA_DESCRIPTION,
  path = '/',
  imageUrl,
  type = 'website',
  origin,
  noindex = shouldAddNoIndexMeta(),
}: WebMetadataProps) {
  const resolvedOrigin = resolveWebMetadataOrigin(origin);
  const absoluteUrl = resolvedOrigin
    ? buildAbsoluteUrl(path, resolvedOrigin)
    : null;
  const twitterCard = imageUrl ? 'summary_large_image' : 'summary';

  return (
    <Head>
      <title>{title}</title>
      <meta name='description' content={description} />
      {absoluteUrl ? <link rel='canonical' href={absoluteUrl} /> : null}
      <meta property='og:site_name' content='WhereWild' />
      <meta property='og:type' content={type} />
      <meta property='og:title' content={title} />
      <meta property='og:description' content={description} />
      {absoluteUrl ? <meta property='og:url' content={absoluteUrl} /> : null}
      {imageUrl ? <meta property='og:image' content={imageUrl} /> : null}
      {noindex ? <meta name='robots' content='noindex, nofollow' /> : null}
      <meta name='twitter:card' content={twitterCard} />
      <meta name='twitter:title' content={title} />
      <meta name='twitter:description' content={description} />
      {imageUrl ? <meta name='twitter:image' content={imageUrl} /> : null}
    </Head>
  );
}

export const __WEB_METADATA_TESTING__ = {
  buildAbsoluteUrl,
  buildMetadataDocument,
  escapeHtml,
  normalizeMetadataPath,
  renderMetadataHtmlDocument,
  resolveOpenGraphImageUrl,
  resolveMetadataOrigin,
  resolveWebMetadataOrigin,
  shouldAddNoIndexMeta,
};
