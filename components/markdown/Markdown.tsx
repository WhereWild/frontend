// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size, type ColorPalette } from '@/constants/theme';
import { useLayoutChrome } from '@/context/LayoutChromeContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import {
  anchorScrollMarginStyle,
  scrollToElementId,
  slugifySection,
} from '@/utils/anchors';
import { useRouter, type Href } from 'expo-router';
import { lexer, type MarkedToken, type Token } from 'marked';
import React from 'react';
import {
  Linking,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { ThemedText } from '../text/ThemedText';

export type MarkdownProps = {
  children: string;
  style?: StyleProp<ViewStyle>;
};

const isHashHref = (href: string) => href.startsWith('#');
const isInternalHref = (href: string) => href.startsWith('/');

const navigateToHref = (href: string, router: ReturnType<typeof useRouter>) => {
  if (isHashHref(href)) {
    scrollToElementId(href.slice(1));
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history?.replaceState?.(null, '', href);
    }
  } else if (isInternalHref(href)) {
    router.push(href as Href);
  } else {
    Linking.openURL(href);
  }
};

// Flattens inline tokens back to plain text for slug generation — headings
// can contain bold/code/link spans, but the anchor id only needs the text.
function tokensToPlainText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      const markedToken = token as MarkedToken;
      if ('text' in markedToken && typeof markedToken.text === 'string') {
        return markedToken.text;
      }
      return '';
    })
    .join('');
}

// Renders the inline (character-level) tokens within a block: text, bold,
// italic, strikethrough, inline code, links, and line breaks.
function renderInlineTokens(
  tokens: Token[],
  router: ReturnType<typeof useRouter>,
  keyPrefix: string,
): React.ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    const markedToken = token as MarkedToken;

    switch (markedToken.type) {
      case 'text':
        return markedToken.tokens ? (
          <React.Fragment key={key}>
            {renderInlineTokens(markedToken.tokens, router, key)}
          </React.Fragment>
        ) : (
          markedToken.text
        );
      case 'strong':
        return (
          <ThemedText key={key} variant='bodyStrong'>
            {renderInlineTokens(markedToken.tokens, router, key)}
          </ThemedText>
        );
      case 'em':
        return (
          <ThemedText key={key} style={styles.italic}>
            {renderInlineTokens(markedToken.tokens, router, key)}
          </ThemedText>
        );
      case 'del':
        return (
          <ThemedText key={key} style={styles.strikethrough}>
            {renderInlineTokens(markedToken.tokens, router, key)}
          </ThemedText>
        );
      case 'codespan':
        return (
          <ThemedText key={key} variant='code'>
            {markedToken.text}
          </ThemedText>
        );
      case 'link':
        return (
          <ThemedText
            key={key}
            variant='link'
            onPress={() => navigateToHref(markedToken.href, router)}
          >
            {renderInlineTokens(markedToken.tokens, router, key)}
          </ThemedText>
        );
      case 'br':
        return '\n';
      default:
        return null;
    }
  });
}

// Renders block-level tokens: headings, paragraphs, lists, blockquotes,
// fenced code blocks, and horizontal rules.
function renderBlockTokens(
  tokens: Token[],
  router: ReturnType<typeof useRouter>,
  keyPrefix: string,
  palette: ColorPalette,
  seenSlugs: Map<string, number>,
  scrollMarginStyle: TextStyle | undefined,
): React.ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    const markedToken = token as MarkedToken;

    switch (markedToken.type) {
      case 'heading': {
        const variant =
          markedToken.depth <= 1
            ? 'heading'
            : markedToken.depth === 2
              ? 'subheading'
              : 'bodyStrong';
        const slug = slugifySection(
          tokensToPlainText(markedToken.tokens),
          seenSlugs,
        );
        return (
          <ThemedText
            key={key}
            variant={variant}
            {...(Platform.OS === 'web'
              ? { nativeID: slug, style: scrollMarginStyle }
              : {})}
          >
            {renderInlineTokens(markedToken.tokens, router, key)}
          </ThemedText>
        );
      }
      case 'paragraph':
      case 'text':
        return (
          <ThemedText key={key} variant='body'>
            {renderInlineTokens(markedToken.tokens ?? [], router, key)}
          </ThemedText>
        );
      case 'list':
        return (
          <View key={key} style={styles.list}>
            {markedToken.items.map((item, itemIndex) => {
              const itemKey = `${key}-${itemIndex}`;
              const marker = markedToken.ordered
                ? `${(Number(markedToken.start) || 1) + itemIndex}.`
                : '•';
              return (
                <View key={itemKey} style={styles.listItem}>
                  <ThemedText variant='body' style={styles.listMarker}>
                    {marker}
                  </ThemedText>
                  <View style={styles.listItemContent}>
                    {renderBlockTokens(
                      item.tokens,
                      router,
                      itemKey,
                      palette,
                      seenSlugs,
                      scrollMarginStyle,
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        );
      case 'blockquote':
        return (
          <View
            key={key}
            style={[
              styles.blockquote,
              { borderLeftColor: palette.border.default.secondary },
            ]}
          >
            {renderBlockTokens(
              markedToken.tokens,
              router,
              key,
              palette,
              seenSlugs,
              scrollMarginStyle,
            )}
          </View>
        );
      case 'code':
        return (
          <View
            key={key}
            style={[
              styles.codeBlock,
              { backgroundColor: palette.background.default.secondary },
            ]}
          >
            <ThemedText variant='code'>{markedToken.text}</ThemedText>
          </View>
        );
      case 'hr':
        return (
          <View
            key={key}
            style={[
              styles.hr,
              { backgroundColor: palette.border.default.secondary },
            ]}
          />
        );
      case 'space':
        return null;
      default:
        return null;
    }
  });
}

// Renders straight to View/ThemedText (no HTML), so it works identically
// on web and native with no per-platform overrides.
export function Markdown({ children, style }: MarkdownProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const { webHeaderHeight } = useLayoutChrome();
  const responsive = useResponsive();
  const scrollMarginStyle =
    Platform.OS === 'web'
      ? anchorScrollMarginStyle(webHeaderHeight, responsive.breakpoint)
      : undefined;
  const tokens = React.useMemo(() => lexer(children), [children]);
  // Fresh per render — only needs to dedupe slugs within a single pass over
  // this render's headings, not across renders.
  const seenSlugs = new Map<string, number>();

  useScrollToHash([tokens]);

  return (
    <View style={[styles.container, style]}>
      {renderBlockTokens(
        tokens,
        router,
        'md',
        palette,
        seenSlugs,
        scrollMarginStyle,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Size.space.text.paragraph,
  },
  italic: {
    fontStyle: 'italic',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  list: {
    gap: Size.space.text.line,
  },
  listItem: {
    flexDirection: 'row',
    gap: Size.space['200'],
  },
  listMarker: {
    minWidth: Size.space['400'],
  },
  listItemContent: {
    flex: 1,
    gap: Size.space.text.line,
  },
  blockquote: {
    borderLeftWidth: Size.stroke.border,
    paddingLeft: Size.space['400'],
    gap: Size.space.text.line,
  },
  codeBlock: {
    padding: Size.space['400'],
    borderRadius: Size.radius['200'],
  },
  hr: {
    height: Size.stroke.border,
  },
});
