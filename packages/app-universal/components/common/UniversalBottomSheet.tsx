import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  BackHandler,
  Pressable,
} from 'react-native';

interface UniversalBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  maxHeight?: number | string;
  children: React.ReactNode;
}

export const UniversalBottomSheet: React.FC<UniversalBottomSheetProps> = ({
  visible,
  onClose,
  maxHeight = '90%',
  children,
}) => {
  const [shouldRender, setShouldRender] = useState(visible);
  const screenHeight = Dimensions.get('window').height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (shouldRender) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setShouldRender(false));
    }
  }, [visible, screenHeight]);

  useEffect(() => {
    if (!visible) return;

    const backAction = () => {
      onClose();
      return true;
    };

    const handler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => handler.remove();
  }, [visible, onClose]);

  if (!shouldRender && !visible) {
    return null;
  }

  return (
    <View style={styles.overlayContainer} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Fondo oscuro traslúcido animado */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            opacity: fadeAnim,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Contenedor tipo hoja inferior que desliza hacia arriba */}
      <Animated.View
        style={[
          styles.sheet,
          {
            maxHeight: typeof maxHeight === 'number' ? maxHeight : maxHeight,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99990,
    elevation: 25,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 30,
  },
});
