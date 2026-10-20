import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { geocodingService, GeocodingSuggestion } from '../../services/geocodingService';
import { GeoPoint } from '@plataforma/shared';

interface AddressAutocompleteProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectLocation: (point: GeoPoint, addressText: string) => void;
  placeholder?: string;
  nearLocation?: GeoPoint | null;
  rightAction?: React.ReactNode;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  label,
  value,
  onChangeText,
  onSelectLocation,
  placeholder,
  nearLocation,
  rightAction,
}) => {
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceTimerRef = useRef<any>(null);

  const handleInputChange = (text: string) => {
    onChangeText(text);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (text.trim().length >= 3) {
      setLoading(true);
      debounceTimerRef.current = setTimeout(async () => {
        const results = await geocodingService.searchAddress(text, nearLocation);
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setLoading(false);
      }, 400);
    } else {
      setSuggestions([]);
      setIsOpen(false);
      setLoading(false);
    }
  };

  const handleSelect = (s: GeocodingSuggestion) => {
    onSelectLocation({ latitude: s.latitude, longitude: s.longitude }, s.shortName || s.displayName);
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <View className="w-full mb-3 relative z-30">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs font-bold text-slate-700">{label}</Text>
        {rightAction}
      </View>

      <View className="relative flex-row items-center">
        <TextInput
          value={value}
          onChangeText={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder || 'Buscar calle, barrio o lugar...'}
          placeholderTextColor="#94A3B8"
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 pr-10"
        />
        {loading && (
          <View className="absolute right-3">
            <ActivityIndicator size="small" color="#FF6B00" />
          </View>
        )}
      </View>

      {/* Menú Flotante de Sugerencias Nominatim */}
      {isOpen && suggestions.length > 0 && (
        <View className="absolute top-[68px] left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-56">
          {suggestions.map((s, idx) => (
            <TouchableOpacity
              key={`${s.latitude}_${s.longitude}_${idx}`}
              onPress={() => handleSelect(s)}
              className="px-4 py-2.5 border-b border-slate-100 flex-row items-center gap-2.5 active:bg-slate-50"
            >
              <Text className="text-base">📍</Text>
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-900" numberOfLines={1}>
                  {s.shortName}
                </Text>
                <Text className="text-[11px] text-slate-500" numberOfLines={1}>
                  {s.city ? `${s.city} • ` : ''}{s.displayName}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};
