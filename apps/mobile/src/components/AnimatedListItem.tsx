import React, { useRef } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { ViewStyle, StyleProp } from 'react-native';

interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
}

export default function AnimatedListItem({ children, index, style }: AnimatedListItemProps) {
  const hasAnimated = useRef(false);

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
