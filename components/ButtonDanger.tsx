import React from 'react';
import { Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Colors, Size, Typography } from '../constants/theme';
import { useColorScheme } from '../hooks/useColorScheme';


export type ButtonDangerVariant = 'primary' | 'subtle';
export type ButtonDangerSize = 'small' | 'medium';

export interface ButtonDangerProps {
    variant?: ButtonDangerVariant;
    size?: ButtonDangerSize;
    disabled?: boolean;
    loading?: boolean;
    onPress?: () => void;
    children?: React.ReactNode;
    label?: string;
    iconStart?: React.ReactNode;
    iconEnd?: React.ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
    accessibilityLabel?: string;
}

function computeDangerStyles(
    variant: ButtonDangerVariant,
    mode: 'light' | 'dark',
    pressed: boolean,
    hovered: boolean,
    disabled: boolean,
) {
    const palette = Colors[mode];
    const strokeWidth = Size.stroke.border;
    const transparent = 'transparent';

    if (disabled) {
        return {
            backgroundColor: palette.background.disabled.default,
            color: palette.text.disabled.onDisabled,
            iconColor: palette.icon.disabled.onDisabled,
            borderColor: transparent,
            borderWidth: 0,
        };
    }

    if (variant === 'primary') {
        return {
            backgroundColor: pressed
                ? palette.background.danger.pressed
                : (hovered ? palette.background.danger.hover : palette.background.danger.default),
            color: palette.text.danger.onDanger,
            iconColor: palette.icon.danger.onDanger,
            borderColor: transparent,
            borderWidth: 0,
        };
    }

    // Subtle variant - transparent background by default, uses secondary backgrounds on interaction
    const isOutlinedState = !(pressed || hovered);
    const borderWidth = strokeWidth;
    return {
        backgroundColor: pressed
            ? palette.background.danger.secondaryPressed
            : (hovered ? palette.background.danger.secondaryHover : transparent),
        color: pressed || hovered
            ? palette.text.danger.onDangerSecondary
            : palette.text.danger.secondary,
        iconColor: pressed || hovered
            ? palette.icon.danger.onDangerSecondary
            : palette.icon.danger.secondary,
        borderColor: isOutlinedState ? palette.border.danger.secondary : transparent,
        borderWidth,
    };
}

function computeSizeStyles(size: ButtonDangerSize) {
    if (size === 'small') {
        return {
            paddingHorizontal: Size.space['200'],
            paddingVertical: Size.space['200'],
        };
    }
    return {
        paddingHorizontal: Size.space['300'],
        paddingVertical: Size.space['300'],
    };
}

const renderIcon = (iconNode: React.ReactNode, color: string) => {
    if (!React.isValidElement(iconNode)) {
        return iconNode;
    }

    const currentProps = iconNode.props as { color?: string; size?: string | number };
    const nextProps: Record<string, unknown> = {};

    if (currentProps.color == null) {
        nextProps.color = color;
    }

    if (currentProps.size == null) {
        nextProps.size = '16';
    }

    if (Object.keys(nextProps).length === 0) {
        return iconNode;
    }

    return React.cloneElement(iconNode, nextProps);
};

export const ButtonDanger: React.FC<ButtonDangerProps> = ({
    variant = 'primary',
    size = 'medium',
    disabled = false,
    loading = false,
    onPress,
    children,
    label,
    iconStart,
    iconEnd,
    style,
    textStyle,
    accessibilityLabel,
}) => {
    const mode = useColorScheme() === 'dark' ? 'dark' : 'light';

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={
                accessibilityLabel ||
                (label ?? (typeof children === 'string' ? children : undefined))
            }
            disabled={disabled || loading}
            onPress={onPress}
            style={({ pressed, hovered }) => {
                const v = computeDangerStyles(variant, mode, pressed, hovered ?? false, disabled || loading);
                const s = computeSizeStyles(size);
                const borderWidth = v.borderWidth ?? 0;
                const paddingHorizontal = Math.max(0, s.paddingHorizontal - borderWidth);
                const paddingVertical = Math.max(0, s.paddingVertical - borderWidth);
                return [
                    {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: Size.radius['200'],
                        backgroundColor: v.backgroundColor,
                        borderColor: v.borderColor,
                        borderWidth: v.borderWidth,
                        opacity: loading ? 0.7 : 1,
                        paddingHorizontal,
                        paddingVertical,
                        gap: Size.space['200'],
                    },
                    style,
                ];
            }}
        >
            {({ pressed, hovered }) => {
                const v = computeDangerStyles(variant, mode, pressed, hovered ?? false, disabled || loading);
                return (
                    <>
                        {iconStart && !loading && (
                            <View>
                                {renderIcon(iconStart, v.iconColor)}
                            </View>
                        )}
                        <Text
                            style={[
                                Typography[mode].singleLineBody,
                                {
                                    color: v.color,
                                },
                                textStyle,
                            ]}
                        >
                            {loading ? '…' : (label ?? children)}
                        </Text>
                        {iconEnd && !loading && (
                            <View>
                                {renderIcon(iconEnd, v.iconColor)}
                            </View>
                        )}
                    </>
                );
            }}
        </Pressable>
    );
};

export const __BUTTON_DANGER_TESTING__ = {
    computeDangerStyles,
};
