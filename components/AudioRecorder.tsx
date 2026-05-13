import React, { useState, useRef } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@lib/supabase';
import { Colors } from '@constants/colors';
import { Typography } from '@constants/typography';

type Props = {
  disabled: boolean;
  onTranscription: (text: string) => void;
};

type RecordingState = 'idle' | 'recording' | 'transcribing';

export default function AudioRecorder({ disabled, onTranscription }: Props) {
  const [state, setState] = useState<RecordingState>('idle');
  const recordingRef = useRef<Audio.Recording | null>(null);

  // ── Start Recording ─────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Denied', 'Microphone access is needed for voice notes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setState('recording');
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  };

  // ── Stop & Transcribe ───────────────────────────────────────────
  const stopAndTranscribe = async () => {
    if (!recordingRef.current) return;

    setState('transcribing');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('No audio file found.');

      // Read file as base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64' as any,
      });

      // Delete the local file — audio is not stored
      await FileSystem.deleteAsync(uri, { idempotent: true });

      // Send to Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio_base64: base64Audio },
      });

      if (error) throw error;
      if (!data?.text) throw new Error('Transcription returned empty.');

      onTranscription(data.text as string);
    } catch (err: any) {
      console.error('Transcription error:', err);
      Alert.alert('Transcription Failed', err.message ?? 'Could not transcribe audio.');
    } finally {
      setState('idle');
      // Reset audio mode
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    }
  };

  // ── Press Handler ───────────────────────────────────────────────
  const handlePress = () => {
    if (state === 'idle') startRecording();
    else if (state === 'recording') stopAndTranscribe();
  };

  const isRecording = state === 'recording';
  const isTranscribing = state === 'transcribing';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        id="audio-record-btn"
        style={[
          styles.btn,
          isRecording && styles.btnRecording,
          (disabled || isTranscribing) && styles.btnDisabled,
        ]}
        onPress={handlePress}
        disabled={disabled || isTranscribing}
        activeOpacity={0.8}
      >
        {isTranscribing ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Text style={styles.icon}>
            {isRecording ? '⏹️' : '🎙️'}
          </Text>
        )}
      </TouchableOpacity>
      <Text style={[styles.label, disabled && styles.labelDisabled]}>
        {isTranscribing ? 'Transcribing...' : isRecording ? 'Tap to stop' : 'Voice'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4 },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgInput,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnRecording: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.error,
  },
  btnDisabled: { opacity: 0.4 },
  icon: { fontSize: 20 },
  label: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  labelDisabled: { color: Colors.textMuted },
});
