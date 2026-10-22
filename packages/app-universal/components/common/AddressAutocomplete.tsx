import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
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
        try {
          const results = await geocodingService.searchAddress(text, nearLocation);
          setSuggestions(results);
          setIsOpen(results.length > 0);
        } catch {
          setSuggestions([]);
          setIsOpen(false);
        } finally {
          setLoading(false);
        }
      }, 300);
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
    <View
      className="w-full mb-3 relative"
      style={{
        zIndex: isOpen ? 50 : 1,
        elevation: isOpen ? 30 : 0,
      }}
    >
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
        {loading ? (
          <View className="absolute right-3">
            <ActivityIndicator size="small" color="#FF6B00" />
          </View>
        ) : value.length > 0 ? (
          <TouchableOpacity
            onPress={() => {
              onChangeText('');
              setSuggestions([]);
              setIsOpen(false);
            }}
            className="absolute right-3 w-6 h-6 rounded-full bg-slate-200 items-center justify-center active:bg-slate-300"
          >
            <Text className="text-slate-600 text-xs font-bold">✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Menú Flotante de Sugerencias OpenStreetMap */}
      {isOpen && suggestions.length > 0 && (
        <View
          className="absolute top-[68px] left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
          style={{ elevation: 30, zIndex: 9999, maxHeight: 220 }}
        >
          <ScrollView
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            className="w-full"
          >
            {suggestions.map((s, idx) => (
              <TouchableOpacity
                key={`${s.latitude}_${s.longitude}_${idx}`}
                activeOpacity={0.7}
                onPress={() => handleSelect(s)}
                className="px-4 py-2.5 border-b border-slate-100 flex-row items-center gap-2.5 active:bg-orange-50/50"
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
          </ScrollView>
        </View>
      )}
    </View>
  );
};
