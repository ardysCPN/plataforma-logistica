import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary active:bg-primary-hover text-white';
      case 'secondary':
        return 'bg-secondary active:bg-secondary-surface text-white';
      case 'danger':
        return 'bg-danger active:bg-red-600 text-white';
      case 'outline':
        return 'bg-transparent border border-secondary text-secondary';
      default:
        return 'bg-primary text-white';
    }
  };

  const getTextColor = () => {
    if (variant === 'outline') return 'text-secondary';
    return 'text-white';
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      className={`py-3.5 px-6 rounded-xl flex-row items-center justify-center ${getVariantStyles()} ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? '#0F172A' : '#FFFFFF'} />
      ) : (
        <Text className={`font-semibold text-base tracking-wide ${getTextColor()}`}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};
