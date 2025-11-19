# WhereWild Front-End (Expo/React Native) Copilot Instructions

Welcome to the WhereWild front-end application! This is an Expo-based React Native application that implements the WhereWild Design System.

## Project Overview

WhereWild is a web application designed to simplify the process of finding interesting species of flora and fauna for naturalists, researchers, and explorers alike. It outlines locations where these species can be found and all environmental factors that may be relevant to spotting them.

WhereWild is a tool for naturalists and citizen scientists to gain insight into what species grow in their area and the distribution patterns of species dependent on geospatial and climate data. The application applies Species Distribution Model (SDM) approaches to predict the distribution of species across geographical space and time, with a focus on real-time prediction capabilities.

### Key Features

- View extensive aggregate data on any species from various data sources
- Environmental factor summaries (climate, soil data, time of day/year)
- Associated species information
- Local heatmaps displaying areas where species might appear on a given day
- Highlighting of uncommon species

### Technical Stack

- 📱 **Expo Framework**: Cross-platform mobile development with React Native
- 🎨 **Design System Integration**: Synced tokens from WhereWild Design System
- 🎯 **TypeScript**: Fully typed application
- 🌗 **Theme Support**: Light/dark mode with automatic detection

## Getting Started

### Development Commands

- `npm start` - Start Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser
- `npm run sync-theme` - Sync design tokens from design system repository

### Key Resources

- Design System: [WhereWild Design System](../wherewild-design-system)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)

## Token Usage Guidelines

Always import design tokens from `constants/theme.ts`:

```typescript
import { View, Text } from 'react-native';
import { Colors, Typography, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

function Example() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <View style={{
      backgroundColor: Colors[mode].background.brand.default,
      padding: Size.space[400],
      borderRadius: Size.radius[200],
    }}>
      <Text style={[
        Typography[mode].body,
        { color: Colors[mode].text.brand.onBrand },
      ]}>
        Content
      </Text>
    </View>
  );
}   backgroundColor: Colors[mode].background.brand.default,
      padding: Size.space[400],
      borderRadius: Size.radius[200],
    }}>
      <Text style={[
        Typography[mode].body,
        { color: Colors[mode].text.brand.onBrand },
      ]}>
        Content
      </Text>
    </View>
  );
}
```

⚠️ **Never import from `wdsTokens.ts`** - it contains raw auto-generated tokens not structured for component use:

```typescript
// NEVER DO THIS
import { wdsPrimitiveTokens, wdsSemanticTokens } from '@/constants/wdsTokens';
const color = wdsSemanticTokens.light['background/brand/default'];
```

## Quick Start Checklist

Before implementing any feature or design:

1. ✅ **Use React Native components** - `View`, `Text`, `Pressable`, not web elements
2. ✅ **Use StyleSheet or inline styles** - No CSS files in React Native
3. ✅ **Import tokens from `theme.ts`** - `Colors`, `Typography`, `Size` (never from `wdsTokens.ts`)
4. ✅ **Handle both color modes** - Use `useColorScheme()` for light/dark switching
5. ✅ **Test on multiple platforms** - iOS, Android, and web if applicable
6. ✅ **Keep implementations KISS** - Favor the simplest approach that meets requirements before adding abstractions

## File Structure & Architecture

### Naming Conventions

Following [Expo best practices](https://expo.dev/blog/expo-app-folder-structure-best-practices):

- **Component files**: PascalCase (`Button.tsx`, `ThemedText.tsx`)
- **Utility files**: camelCase (`useColorScheme.ts`, `useThemeColor.ts`)
- **Component exports**: PascalCase (`Button`, `ThemedText`)
- **Hook files**: camelCase with `use` prefix (`useColorScheme.ts`)
- **Constant files**: kebab-case (`theme.ts`, `wds-theme.css`)

### Core Directories

```
app/
├── _layout.tsx         # Root layout with providers
├── index.tsx           # Home screen
└── (tabs)/             # Tab navigation screens

components/
├── Button.tsx          # Reusable UI components
├── ThemedText.tsx      # Theme-aware text component
└── ...                 # Additional components

constants/
├── theme.ts            # ✅ IMPORT FROM HERE - Structured token constants
├── wdsTokens.ts        # ❌ DO NOT IMPORT - Raw synced tokens (auto-generated)
└── wds-theme.css       # CSS tokens for web compatibility

hooks/
├── useColorScheme.ts        # Color scheme detection hook
├── useThemeColor.ts         # Theme color hook
└── useTypographyStyles.ts   # Typography utilities

scripts/
└── sync-theme.cjs      # Syncs tokens from design system

assets/
└── images/             # Image assets
```

### Barrel Exports

To keep imports clean and future-proof, export components from a barrel file and import from the folder root:

```ts
// components/index.ts
export { Button } from './Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button';

export { ButtonDanger } from './ButtonDanger';
export type { ButtonDangerProps, ButtonDangerSize, ButtonDangerVariant } from './ButtonDanger';

export { ThemedText } from './ThemedText';
```

Usage:

```ts
import { Button, ButtonDanger, ThemedText } from '@/components';
```

## React Native vs Web React

### Key Differences

| Web React | React Native | Purpose |
|-----------|--------------|---------|
| `<div>` | `<View>` | Container |
| `<span>`, `<p>` | `<Text>` | Text content |
| `<button>` | `<Pressable>` or `<TouchableOpacity>` | Buttons |
| `<img>` | `<Image>` | Images |
| `<input>` | `<TextInput>` | Text input |
| CSS files | `StyleSheet.create()` | Styling |
| `className` | `style` prop | Applying styles |

### Styling Patterns

#### Web (CSS)

```css
.button {
  background: var(--wds-color-background-brand-default);
  padding: var(--wds-size-space-400);
}
```

#### React Native (StyleSheet)

```typescript
import { Colors, Size } from '@/constants/theme';

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.light.background.brand.default,
    padding: Size.space[400],
  },
});
```

## Common Implementation Patterns

> **Note:** For available token structures (`Colors`, `Typography`, `Size`), refer to `constants/theme.ts`.

### Button Component Example

The repository already includes fully-implemented button components. Import and use them:

```typescript
import { Button, ButtonDanger, IconButton } from '@/components';

// Primary button (brand green)
<Button variant="primary" size="medium" onPress={handleSubmit}>
  Submit
</Button>

// Neutral button (gray)
<Button variant="neutral" size="small" onPress={handleCancel}>
  Cancel
</Button>

// Subtle button (transparent → gray on hover)
<Button variant="subtle" onPress={handleSkip}>
  Skip
</Button>

// Danger button for destructive actions
<ButtonDanger variant="primary" onPress={handleDelete}>
  Delete
</ButtonDanger>

// Icon-only button
<IconButton
  variant="subtle"
  size="medium"
  icon={<YourIcon />}
  accessibilityLabel="Close"
  onPress={handleClose}
/>
```

All buttons support:
- **Variants**: `primary`, `neutral`, `subtle` (+ `ButtonDanger` for destructive actions)
- **Sizes**: `small`, `medium`
- **States**: `disabled`, `loading`
- **Icons**: `iconStart`, `iconEnd` props
- **Accessibility**: Proper ARIA labels and roles
```

### Text Component with Theme

```typescript
import { Text as RNText, StyleSheet } from 'react-native';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

type ThemedTextProps = {
  variant?: 'default' | 'secondary' | 'brand';
  type?: 'body' | 'heading' | 'subtitle';
  children: React.ReactNode;
};

export function ThemedText({ 
  variant = 'default',
  type = 'body',
  children 
}: ThemedTextProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  
  return (
    <RNText style={[
      {
        color: Colors[mode].text[variant].default,
        fontFamily: Typography[type].fontFamily,
        fontSize: Typography[type].size.medium,
        fontWeight: Typography[type].fontWeight,
      },
    ]}>
      {children}
    </RNText>
  );
}
```

### Layout with Spacing

```typescript
import { View, StyleSheet } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

export function Section({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  
  return (
    <View style={[
      styles.section,
      { backgroundColor: Colors[mode].background.default.default },
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: Size.space[600],
    gap: Size.space[400],
  },
});
```

## Figma MCP Integration Rules
These rules define how to translate Figma inputs into code for this project and must be followed for every Figma-driven change.

### Required flow (do not skip)
1. Run `mcp_figma_mcp-ser_get_design_context` first to fetch the structured representation for the exact node(s). Requires `nodeId` and `fileKey` parameters.
2. If the response is too large or truncated, run `mcp_figma_mcp-ser_get_metadata` to get the high‑level node map and then re‑fetch only the required node(s) with get_design_context.
3. Run `mcp_figma_mcp-ser_get_screenshot` for a visual reference of the node variant being implemented.
4. Optionally run `mcp_figma_mcp-ser_get_variable_defs` to see resolved Figma variable values applied to the node.
5. Only after you have both get_design_context and get_screenshot, download any assets needed and start implementation.
6. Translate the output (usually React + Tailwind) into this project's conventions, styles and framework. Reuse the project's color tokens, components, and typography wherever possible.
7. Validate against Figma for 1:1 look and behavior before marking complete.

### Implementation rules
- Treat the Figma MCP output (React + Tailwind) as a representation of design and behavior, not as final code style.
- Convert all Tailwind classes to React Native StyleSheet or inline styles using design tokens.
- Replace `<div>` with `<View>`, `<p>` with `<Text>`, `className` with `style` prop, etc.
- Reuse existing components from `@/components` (`Button`, `ButtonDanger`, `IconButton`, `ThemedText`) instead of duplicating functionality.
- Use the project's `Colors[mode]`, `Typography[mode]`, and `Size` tokens consistently—never hardcode values.
- Handle both light and dark modes using `useColorScheme()` hook.
- Respect existing routing, state management, and data‑fetch patterns already adopted in the repo.
- Strive for 1:1 visual parity with the Figma design. When conflicts arise, prefer design‑system tokens and adjust spacing or sizes minimally to match visuals.
- Validate the final UI against the Figma screenshot for both look and behavior.

## Best Practices & Common Pitfalls

### Essential Rules

- **Use React Native components** - `View`, `Text`, `Pressable`, not web elements
- **Use StyleSheet.create()** - Optimize styles with React Native's StyleSheet API
- **Import tokens from `theme.ts`** - Use `Colors`, `Typography`, `Size` (not `wdsTokens.ts`)
- **Handle color modes** - Always consider light/dark mode in your components
- **Use typed props** - Leverage TypeScript for better DX

### Common Pitfalls & Solutions

### ❌ Pitfall 1: Importing from wdsTokens

```typescript
// WRONG
import { wdsSemanticTokens } from '@/constants/wdsTokens';
const color = wdsSemanticTokens.light['background/brand/default'];
```

#### Fix

Import structured constants:

```typescript
import { Colors } from '@/constants/theme';
const color = Colors.light.background.brand.default;
```

### ❌ Pitfall 2: Using web elements

```typescript
// WRONG
<div className="container">
  <button onClick={handlePress}>Click</button>
</div>
```

#### Fix

Use React Native components:

```typescript
<View style={styles.container}>
  <Pressable onPress={handlePress}>
    <Text>Click</Text>
  </Pressable>
</View>
```

### ❌ Pitfall 3: Hardcoding design values

```typescript
// WRONG
<View style={{ backgroundColor: '#466237', padding: 16 }}>
```

#### Fix

Use tokens from theme.ts:

```typescript
<View style={{ 
  backgroundColor: Colors.light.background.brand.default,
  padding: Size.space[400],
}}>
```

### ❌ Pitfall 4: Not handling color modes

```typescript
// WRONG
<View style={{ backgroundColor: Colors.light.background.default.default }}>
```

#### Fix

Use useColorScheme hook:

```typescript
const colorScheme = useColorScheme();
const mode = colorScheme === 'dark' ? 'dark' : 'light';
<View style={{ backgroundColor: Colors[mode].background.default.default }}>
```

### ❌ Pitfall 5: Using CSS variables

```typescript
// WRONG - CSS variables don't work in React Native
<View style={{ backgroundColor: 'var(--wds-color-background-brand-default)' }}>
```

#### Fix

Use structured constants:

```typescript
<View style={{ backgroundColor: Colors.light.background.brand.default }}>
```

## Token Sync Process

Design tokens are synced from the WhereWild Design System repository:

1. **Source**: Design tokens are defined in Figma and synced to `wherewild-design-system/src/theme.css`
2. **Sync Script**: `scripts/sync-theme.cjs` copies tokens from design system to this repo
3. **Auto-Generated**: `constants/wdsTokens.ts` is created from the CSS tokens
4. **Manual Structure**: `constants/theme.ts` exports structured constants for component use

To sync tokens, run `npm run sync-theme` in this repository.

### Token Flow

```
Figma Design
    ↓
Design System (theme.css)
    ↓
sync-theme.cjs
    ↓
wdsTokens.ts (auto-generated, DO NOT IMPORT)
    ↓
theme.ts (structured constants, IMPORT FROM HERE)
    ↓
Your Components
```

## Platform-Specific Considerations

### iOS vs Android Differences

- **Shadows**: Use `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius` for iOS; use `elevation` for Android
- **Fonts**: Font weights may render differently; test on both platforms
- **Safe Areas**: Use `SafeAreaView` from `react-native-safe-area-context` for notch handling
- **Haptics**: iOS has more sophisticated haptic feedback options

### Web Compatibility

When running on web:
- `Pressable` works but consider accessibility (focus states, keyboard navigation)
- Some React Native APIs may not be available (e.g., certain native modules)
- Use `Platform.OS === 'web'` to conditionally render web-specific code

## Development Workflow

### Creating New Components

1. **Check existing components** - Reuse `Button`, `ButtonDanger`, `IconButton`, `ThemedText` from `@/components` before creating new ones
2. **Use TypeScript** - Define prop types and export them for better DX
3. **Handle both color modes** - Use `useColorScheme()` hook and `Colors[mode]`, `Typography[mode]` patterns
4. **Use StyleSheet.create()** - Optimize performance with StyleSheet API
5. **Export from barrel file** - Add new components to `components/index.ts` for clean imports
6. **Test on multiple platforms** - iOS, Android, and web

#### Available Components

Import from the barrel export for clean code:

```typescript
import { Button, ButtonDanger, IconButton, ThemedText } from '@/components';
import type { ButtonProps, ButtonDangerVariant, IconButtonSize } from '@/components';

// Button - Primary, Neutral, Subtle variants with Small/Medium sizes
<Button variant="primary" size="medium" onPress={handlePress}>Submit</Button>

// ButtonDanger - Destructive actions
<ButtonDanger variant="primary" size="small" onPress={handleDelete}>Delete</ButtonDanger>

// IconButton - Icon-only buttons
<IconButton 
  variant="subtle" 
  icon={<YourIcon />} 
  accessibilityLabel="Close"
  onPress={handleClose} 
/>

// ThemedText - Theme-aware text
<ThemedText>Your content</ThemedText>
```

## Example Workflow

```typescript
// 1. Import necessary dependencies
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Typography, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

// 2. Define TypeScript types
type CardProps = {
  title: string;
  description: string;
  onPress?: () => void;
};

// 3. Create component with theme support
export function Card({ title, description, onPress }: CardProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed
            ? Colors[mode].background.default.pressed
            : Colors[mode].background.default.default,
          borderColor: Colors[mode].border.default.default,
        },
      ]}
    >
      <Text style={[
        Typography[mode].heading,
        { color: Colors[mode].text.default.default },
      ]}>
        {title}
      </Text>
      <Text style={[
        Typography[mode].body,
        { color: Colors[mode].text.default.secondary },
      ]}>
        {description}
      </Text>
    </Pressable>
  );
}

// 4. Define styles with StyleSheet
const styles = StyleSheet.create({
  card: {
    padding: Size.space[600],
    gap: Size.space[300],
    borderRadius: Size.radius[200],
    borderWidth: Size.stroke.border,
  },
});
```

## Summary

### Key Takeaways

1. **Use React Native components** - Not web elements (`View` not `div`, `Text` not `span`)
2. **Import tokens from `theme.ts`** - `Colors`, `Typography`, `Size` provide structured, typed access
3. **Handle color modes** - Use `useColorScheme()` hook for light/dark theme support
4. **Use StyleSheet.create()** - Optimize performance with React Native's StyleSheet API
5. **Test on all platforms** - iOS, Android, and web

### Quick Reference

```typescript
// ✅ CORRECT
import { Colors, Typography, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
const backgroundColor = Colors[mode].background.brand.default;
const textColor = Colors[mode].text.brand.onBrand;
const padding = Size.space[400];

// ❌ INCORRECT
import { wdsSemanticTokens } from '@/constants/wdsTokens';
const backgroundColor = wdsSemanticTokens.light['background/brand/default'];
```
