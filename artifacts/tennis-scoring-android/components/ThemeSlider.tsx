import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from 'react-native';

interface ThemeSliderProps {
  label: string;
  value: number;
  color: string;
  railColor: string;
  thumbSurfaceColor: string;
  shadowColor: string;
  testID: string;
  disabled?: boolean;
  onValueChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
}

const clampValue = (value: number) =>
  Math.round(Math.max(0, Math.min(100, value)));

export function ThemeSlider({
  label,
  value,
  color,
  railColor,
  thumbSurfaceColor,
  shadowColor,
  testID,
  disabled = false,
  onValueChange,
  onSlidingComplete,
}: ThemeSliderProps) {
  const widthRef = useRef(1);
  const valueRef = useRef(clampValue(value));
  const disabledRef = useRef(disabled);
  const callbacksRef = useRef({ onValueChange, onSlidingComplete });
  const normalizedValue = clampValue(value);

  useEffect(() => {
    valueRef.current = normalizedValue;
    disabledRef.current = disabled;
    callbacksRef.current = { onValueChange, onSlidingComplete };
  }, [disabled, normalizedValue, onSlidingComplete, onValueChange]);

  const updateFromEvent = useCallback((event: GestureResponderEvent) => {
    const next = clampValue(
      (event.nativeEvent.locationX / Math.max(1, widthRef.current)) * 100,
    );
    valueRef.current = next;
    callbacksRef.current.onValueChange(next);
    return next;
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        onPanResponderGrant: updateFromEvent,
        onPanResponderMove: updateFromEvent,
        onPanResponderRelease: (event) => {
          const next = updateFromEvent(event);
          callbacksRef.current.onSlidingComplete?.(next);
        },
        onPanResponderTerminate: () => {
          callbacksRef.current.onSlidingComplete?.(valueRef.current);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [updateFromEvent],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = Math.max(1, event.nativeEvent.layout.width);
    widthRef.current = width;
  };

  return (
    <View
      {...responder.panHandlers}
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Adjust from 0 to 100"
      accessibilityState={{ disabled }}
      accessibilityValue={{ min: 0, max: 100, now: normalizedValue }}
      accessibilityActions={[
        { name: 'increment', label: 'Increase' },
        { name: 'decrement', label: 'Decrease' },
      ]}
      onAccessibilityAction={(event) => {
        if (disabled) return;
        const increment =
          event.nativeEvent.actionName === 'increment' ? 5 : -5;
        const next = clampValue(valueRef.current + increment);
        valueRef.current = next;
        onValueChange(next);
        onSlidingComplete?.(next);
      }}
      onLayout={handleLayout}
      style={[styles.track, disabled && styles.disabled]}
    >
      <View style={[styles.rail, { backgroundColor: railColor }]} />
      <View
        style={[
          styles.fill,
          { width: `${normalizedValue}%`, backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.thumb,
          {
            left: `${normalizedValue}%`,
            borderColor: color,
            shadowColor,
            backgroundColor: thumbSurfaceColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 40,
    justifyContent: 'center',
    overflow: 'visible',
  },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    borderWidth: 2,
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  disabled: { opacity: 0.45 },
});
