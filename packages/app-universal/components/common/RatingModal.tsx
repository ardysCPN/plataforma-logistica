import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, Pressable, StyleSheet } from 'react-native';
import { Button } from './Button';

interface RatingModalProps {
  visible: boolean;
  targetName: string;
  onSubmit: (score: number, tags: string[], comment?: string) => Promise<void>;
  onClose: () => void;
}

const TAG_OPTIONS = ['Puntual', 'Amable', 'Excelente trato', 'Vehículo limpio', 'Rápido'];

export const RatingModal: React.FC<RatingModalProps> = ({
  visible,
  targetName,
  onSubmit,
  onClose,
}) => {
  const [score, setScore] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSend = async () => {
    setLoading(true);
    try {
      await onSubmit(score, selectedTags, comment || undefined);
      onClose();
    } catch {
      // Manejar error si es necesario
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 16 }}>
        {/* Backdrop touchable */}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
        />

        <View className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl items-center z-10">
          <Text className="text-xl font-bold text-slate-900 mb-1 text-center">
            Califica el Servicio
          </Text>
          <Text className="text-sm text-slate-500 mb-6 text-center">
            ¿Cómo fue tu experiencia con <Text className="font-semibold text-slate-800">{targetName}</Text>?
          </Text>

          {/* Selector de Estrellas */}
          <View className="flex-row gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setScore(s)}
                activeOpacity={0.7}
                className="p-1"
              >
                <Text className="text-3xl">{s <= score ? '⭐' : '☆'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Etiquetas Contextuales */}
          <View className="flex-row flex-wrap justify-center gap-2 mb-4">
            {TAG_OPTIONS.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full border ${
                    selected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      selected ? 'text-primary' : 'text-slate-600'
                    }`}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Comentario Opcional */}
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Comentario adicional (opcional)..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 mb-6"
          />

          <View className="w-full flex-row gap-3">
            <Button
              title="Omitir"
              variant="outline"
              onPress={onClose}
              className="flex-1"
              disabled={loading}
            />
            <Button
              title="Enviar"
              variant="primary"
              onPress={handleSend}
              loading={loading}
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};
