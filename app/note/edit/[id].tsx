import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, SupabaseNote } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { Colors } from '@constants/colors';
import { Typography } from '@constants/typography';
import AudioRecorder from '@components/AudioRecorder';

const MIN_SUBJECT_LENGTH = 100;

export default function EditNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [titleError, setTitleError] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchNote = async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        const note = data as SupabaseNote;
        setTitle(note.title);
        setSubject(note.subject);
      }
      setLoading(false);
    };
    fetchNote();
  }, [id]);

  const handleTranscription = (text: string) => {
    setSubject(prev => (prev ? prev + ' ' + text : text));
    if (subjectError) setSubjectError('');
  };

  const validate = (): boolean => {
    let valid = true;
    if (!title.trim()) { setTitleError('Note title is required.'); valid = false; }
    else setTitleError('');
    if (!subject.trim()) { setSubjectError('Subject content is required.'); valid = false; }
    else if (subject.trim().length < MIN_SUBJECT_LENGTH) {
      setSubjectError(`Subject must be at least ${MIN_SUBJECT_LENGTH} characters.`);
      valid = false;
    } else setSubjectError('');
    return valid;
  };

  const handleSave = async () => {
    if (!validate() || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ title: title.trim(), subject: subject.trim(), updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Re-generate quiz after edit
      regenerateQuiz();

      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  const regenerateQuiz = async () => {
    try {
      // Delete existing quiz first
      await supabase.from('quizzes').delete().eq('note_id', id);
      // Re-generate
      await supabase.functions.invoke('generate-quiz', {
        body: { note_id: id, title: title.trim(), subject: subject.trim(), user_id: user?.id },
      });
    } catch (e) {
      console.warn('[Quiz] Regeneration failed:', e);
    }
  };

  const charCount = subject.trim().length;
  const charProgress = Math.min(charCount / MIN_SUBJECT_LENGTH, 1);
  const isTitleFilled = title.trim().length > 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity id="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Note</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Text style={styles.label}>Title</Text>
        <TextInput
          id="edit-title-input"
          style={[styles.input, titleError ? styles.inputError : null]}
          placeholder="Note title"
          placeholderTextColor={Colors.textMuted}
          value={title}
          onChangeText={(t) => { setTitle(t); if (titleError) setTitleError(''); }}
        />
        {titleError ? <Text style={styles.errorText}>{titleError}</Text> : null}

        {/* Subject */}
        <Text style={styles.label}>Notes Content</Text>
        <TextInput
          id="edit-subject-input"
          style={[styles.subjectInput, subjectError ? styles.inputError : null]}
          placeholder="Your notes..."
          placeholderTextColor={Colors.textMuted}
          value={subject}
          onChangeText={(t) => { setSubject(t); if (subjectError) setSubjectError(''); }}
          multiline
          textAlignVertical="top"
        />

        {/* Counter Row */}
        <View style={styles.counterRow}>
          <View style={styles.counterLeft}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${charProgress * 100}%` as any,
                backgroundColor: charCount >= MIN_SUBJECT_LENGTH ? Colors.success : Colors.primary,
              }]} />
            </View>
            <Text style={[styles.charCount, charCount >= MIN_SUBJECT_LENGTH ? styles.charOk : null]}>
              {charCount}/{MIN_SUBJECT_LENGTH} min
            </Text>
          </View>
          <AudioRecorder disabled={!isTitleFilled} onTranscription={handleTranscription} />
        </View>
        {subjectError ? <Text style={styles.errorText}>{subjectError}</Text> : null}

        {/* Save Button */}
        <TouchableOpacity
          id="save-note-btn"
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={styles.saveBtnText}>Save Changes</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backArrow: { fontSize: 18, color: Colors.textPrimary },
  headerTitle: {
    flex: 1,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },

  content: { padding: 20, paddingBottom: 60 },

  label: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  subjectInput: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    minHeight: 160,
    marginBottom: 8,
  },
  inputError: { borderColor: Colors.error },

  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  counterLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 12 },
  progressBar: { flex: 1, height: 4, backgroundColor: Colors.bgInput, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  charCount: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    minWidth: 70,
  },
  charOk: { color: Colors.success },

  errorText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
    marginBottom: 8,
  },

  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    letterSpacing: 0.5,
  },
});
