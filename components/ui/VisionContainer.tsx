import { Platform, Pressable, View, StyleSheet } from 'react-native';

export const VisionContainer = ({ style, ...props }) => (
  <View style={[styles.visionContainer, style]} {...props} />
);

export const HoverableView = ({ style, ...props }) => (
  <Pressable 
    style={({ hovered }) => [
      styles.hoverableView,
      hovered && styles.hoverableViewHovered,
      style
    ]}
    {...props}
  />
);

const styles = StyleSheet.create({
  visionContainer: Platform.select({
    visionOS: {
      padding: 20,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
    },
    default: {}
  }),
  hoverableView: Platform.select({
    visionOS: {
      transform: [{ scale: 1 }],
    },
    default: {}
  }),
  hoverableViewHovered: Platform.select({
    visionOS: {
      transform: [{ scale: 1.05 }],
    },
    default: {}
  })
});