import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, SupabaseNote } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { Colors } from '@constants/colors';
import { Typography } from '@constants/typography';
import AudioRecorder from '@components/AudioRecorder';

const MIN_SUBJECT_LENGTH = 100;

export default function NotesScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  // ── Form state ───────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [titleError, setTitleError] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Notes list ───────────────────────────────────────────────────
  const [notes, setNotes] = useState<SupabaseNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Load notes ───────────────────────────────────────────────────
  const fetchNotes = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) setNotes(data as SupabaseNote[]);
    setLoadingNotes(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotes();
  };

  // ── Transcription callback ───────────────────────────────────────
  const handleTranscription = (text: string) => {
    setSubject(prev => (prev ? prev + ' ' + text : text));
    if (subjectError) setSubjectError('');
  };

  // ── Validate & Save ──────────────────────────────────────────────
  const validateForm = (): boolean => {
    let valid = true;
    if (!title.trim()) {
      setTitleError('Note title is required.');
      valid = false;
    } else {
      setTitleError('');
    }
    if (!subject.trim()) {
      setSubjectError('Subject content is required.');
      valid = false;
    } else if (subject.trim().length < MIN_SUBJECT_LENGTH) {
      setSubjectError(`Subject must be at least ${MIN_SUBJECT_LENGTH} characters. (${subject.trim().length}/${MIN_SUBJECT_LENGTH})`);
      valid = false;
    } else {
      setSubjectError('');
    }
    return valid;
  };

  const handleAddNote = async () => {
    if (!validateForm() || !user) return;

    setSaving(true);
    try {
      // 1. Insert note
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .insert({
          user_id: user.id,
          title: title.trim(),
          subject: subject.trim(),
        })
        .select()
        .single();

      if (noteError) throw noteError;

      // 2. Clear form
      setTitle('');
      setSubject('');

      // 3. Refresh notes list
      await fetchNotes();

      // 4. Trigger quiz generation in background (fire & forget — no await)
      generateQuizInBackground(noteData.id, noteData.title, noteData.subject, user.id);

    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  // ── Quiz Generation (background) ─────────────────────────────────
  const generateQuizInBackground = async (
    noteId: string,
    noteTitle: string,
    noteSubject: string,
    userId: string
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: { note_id: noteId, title: noteTitle, subject: noteSubject, user_id: userId },
      });

      if (error) {
        console.warn('[Quiz] Generation failed for note', noteId, error.message);
      } else {
        console.log('[Quiz] Generated successfully for note', noteId);
      }
    } catch (e) {
      console.warn('[Quiz] Unexpected error:', e);
    }
  };

  // ── Delete note ──────────────────────────────────────────────────
  const handleDeleteNote = (note: SupabaseNote) => {
    Alert.alert(
      'Delete Note',
      `Delete "${note.title}"? This will also remove its quiz.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('notes').delete().eq('id', note.id);
            fetchNotes();
          },
        },
      ]
    );
  };

  const charCount = subject.trim().length;
  const charProgress = Math.min(charCount / MIN_SUBJECT_LENGTH, 1);
  const isTitleFilled = title.trim().length > 0;

  // ── Render ───────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>

        {/* ── Top Bar ── */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.user_metadata?.full_name?.split(' ')[0] ?? 'Student'} 👋</Text>
            <Text style={styles.appTitle}>panotes</Text>
          </View>
          <TouchableOpacity id="signout-btn" style={styles.signOutBtn} onPress={signOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* ── Create Note Section (fixed) ── */}
        <View style={styles.createSection}>
          <Text style={styles.sectionLabel}>✏️ New Note</Text>

          {/* Title Input */}
          <TextInput
            id="note-title-input"
            style={[styles.titleInput, titleError ? styles.inputError : null]}
            placeholder="Note title (required)"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={(t) => { setTitle(t); if (titleError) setTitleError(''); }}
            maxLength={80}
            returnKeyType="next"
          />
          {titleError ? <Text style={styles.errorText}>{titleError}</Text> : null}

          {/* Subject Textarea */}
          <TextInput
            id="note-subject-input"
            style={[styles.subjectInput, subjectError ? styles.inputError : null]}
            placeholder={`Write your notes here... (min. ${MIN_SUBJECT_LENGTH} characters)`}
            placeholderTextColor={Colors.textMuted}
            value={subject}
            onChangeText={(t) => { setSubject(t); if (subjectError) setSubjectError(''); }}
            multiline
            textAlignVertical="top"
            editable={true}
          />

          {/* Character Counter Row */}
          <View style={styles.counterRow}>
            <View style={styles.counterLeft}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, {
                  width: `${charProgress * 100}%` as any,
                  backgroundColor: charCount >= MIN_SUBJECT_LENGTH ? Colors.success : Colors.primary,
                }]} />
              </View>
              <Text style={[
                styles.charCount,
                charCount >= MIN_SUBJECT_LENGTH ? styles.charCountOk : null,
                subjectError ? styles.charCountError : null,
              ]}>
                {charCount}/{MIN_SUBJECT_LENGTH} min
              </Text>
            </View>

            {/* Audio Recorder */}
            <AudioRecorder
              disabled={!isTitleFilled}
              onTranscription={handleTranscription}
            />
          </View>
          {subjectError ? <Text style={styles.errorText}>{subjectError}</Text> : null}

          {/* Add Note Button */}
          <TouchableOpacity
            id="add-note-btn"
            style={[styles.addNoteBtn, saving && styles.btnDisabled]}
            onPress={handleAddNote}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Text style={styles.addNoteBtnText}>+ Add Note</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Notes List (scrollable) ── */}
        <ScrollView
          style={styles.notesList}
          contentContainerStyle={styles.notesListContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.listTitle}>
            My Notes {notes.length > 0 ? `(${notes.length})` : ''}
          </Text>

          {loadingNotes ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : notes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🗒️</Text>
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptySubtitle}>Create your first note above!</Text>
            </View>
          ) : (
            notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onPress={() => router.push(`/note/${note.id}`)}
                onDelete={() => handleDeleteNote(note)}
              />
            ))
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Note Card Component ──────────────────────────────────────────────
function NoteCard({
  note,
  onPress,
  onDelete,
}: {
  note: SupabaseNote;
  onPress: () => void;
  onDelete: () => void;
}) {
  const preview = note.subject.length > 100
    ? note.subject.substring(0, 100) + '...'
    : note.subject;

  const dateStr = new Date(note.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <TouchableOpacity
      id={`note-card-${note.id}`}
      style={styles.noteCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.noteCardInner}>
        <View style={styles.noteCardHeader}>
          <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
          <TouchableOpacity
            id={`delete-note-${note.id}`}
            onPress={onDelete}
            style={styles.deleteBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.notePreview} numberOfLines={2}>{preview}</Text>
        <View style={styles.noteCardFooter}>
          <Text style={styles.noteDate}>{dateStr}</Text>
          <Text style={styles.tapHint}>Tap to view →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 16,
    backgroundColor: Colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  greeting: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  appTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.textPrimary,
    letterSpacing: Typography.letterSpacing.tight,
  },
  signOutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signOutText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },

  // Create Section
  createSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: Colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  sectionLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  titleInput: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    marginBottom: 10,
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
    minHeight: 100,
    marginBottom: 8,
  },
  inputError: { borderColor: Colors.error },

  // Counter Row
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  counterLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 12,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.bgInput,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  charCount: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    minWidth: 70,
  },
  charCountOk: { color: Colors.success },
  charCountError: { color: Colors.error },

  // Error
  errorText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
    marginBottom: 6,
    marginTop: -2,
  },

  // Add Note Button
  addNoteBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  addNoteBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    letterSpacing: Typography.letterSpacing.wide,
  },

  // Notes List
  notesList: { flex: 1 },
  notesListContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
  listTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    marginBottom: 16,
  },

  // Note Card
  noteCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  noteCardInner: { padding: 16 },
  noteCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  noteTitle: {
    flex: 1,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    marginRight: 8,
  },
  deleteBtn: { padding: 2 },
  deleteIcon: { fontSize: 18 },
  notePreview: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  noteCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteDate: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  tapHint: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primaryLight,
  },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
});
