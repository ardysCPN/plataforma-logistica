import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';

export interface BannerNotification {
  id: string;
  type: 'CHAT' | 'STATUS' | 'BID' | 'INFO';
  title: string;
  message: string;
  onPress?: () => void;
  data?: any;
}

interface NotificationBannerProps {
  notification: BannerNotification | null;
  onDismiss: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
  onDismiss,
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (notification) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-100);
      opacity.setValue(0);
    }
  }, [notification?.id]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!notification) return null;

  const getIcon = () => {
    switch (notification.type) {
      case 'CHAT':
        return '💬';
      case 'STATUS':
        return '🛵';
      case 'BID':
        return '💰';
      default:
        return '🔔';
    }
  };

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        opacity,
        position: 'absolute',
        top: Platform.OS === 'web' ? 16 : 48,
        left: 16,
        right: 16,
        zIndex: 9999,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          if (notification.onPress) {
            notification.onPress();
          }
          handleClose();
        }}
        className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex-row items-center gap-3"
      >
        <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center border border-primary/40">
          <Text className="text-xl">{getIcon()}</Text>
        </View>

        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-black text-white" numberOfLines={1}>
              {notification.title}
            </Text>
            <Text className="text-[10px] text-slate-400 font-medium">Ahora</Text>
          </View>
          <Text className="text-xs text-slate-300 mt-0.5" numberOfLines={2}>
            {notification.message}
          </Text>
        </View>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="p-1 -mr-1"
        >
          <Text className="text-slate-400 font-bold text-xs">✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};
