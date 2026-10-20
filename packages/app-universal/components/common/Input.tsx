import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label: string;
  error?: string | null;
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <View className={`w-full mb-4 ${className}`}>
      <Text className="text-sm font-medium text-slate-700 mb-1.5">{label}</Text>
      <TextInput
        className={`w-full bg-white border ${
          error ? 'border-danger' : 'border-slate-300'
        } rounded-xl px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-primary`}
        placeholderTextColor="#94A3B8"
        {...props}
      />
      {error ? (
        <Text className="text-danger text-xs mt-1 font-medium">{error}</Text>
      ) : null}
    </View>
  );
};
