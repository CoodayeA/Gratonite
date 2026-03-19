import React, { useRef, useEffect } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { ViewStyle, StyleProp } from 'react-native';

interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  itemKey?: string;
  style?: StyleProp<ViewStyle>;
}

export default function AnimatedListItem({ children, index, itemKey, style }: AnimatedListItemProps) {
  const hasAnimated = useRef(false);
  const prevKeyRef = useRef(itemKey);

  useEffect(() => {
    if (itemKey !== undefined && prevKeyRef.current !== itemKey) {
      hasAnimated.current = false;
      prevKeyRef.current = itemKey;
    }
  }, [itemKey]);

  if (hasAnimated.current) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  hasAnimated.current = true;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).springify()}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
