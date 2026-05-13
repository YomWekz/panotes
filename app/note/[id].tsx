import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, SupabaseNote } from '@lib/supabase';
import { Colors } from '@constants/colors';
import { Typography } from '@constants/typography';

export default function NoteViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = useState<SupabaseNote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNote = async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) setNote(data as SupabaseNote);
      setLoading(false);
    };
    fetchNote();
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note? The quiz will also be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('notes').delete().eq('id', id);
            router.back();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!note) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Note not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const dateStr = new Date(note.created_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity id="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{note.title}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            id="edit-note-btn"
            onPress={() => router.push(`/note/edit/${id}`)}
            style={styles.actionBtn}
          >
            <Text style={styles.actionIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity id="delete-note-btn" onPress={handleDelete} style={styles.actionBtn}>
            <Text style={styles.actionIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Meta */}
        <View style={styles.metaBadge}>
          <Text style={styles.metaText}>📅 {dateStr}</Text>
        </View>

        {/* Title */}
        <Text style={styles.noteTitle}>{note.title}</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Content */}
        <Text style={styles.noteContent}>{note.subject}</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{note.subject.split(' ').length}</Text>
            <Text style={styles.statLabel}>words</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{note.subject.length}</Text>
            <Text style={styles.statLabel}>characters</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
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
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: { fontSize: 17 },

  scroll: { flex: 1 },
  scrollContent: { padding: 24 },

  metaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryGlow,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metaText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },

  noteTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.textPrimary,
    marginBottom: 20,
    lineHeight: 36,
  },
  divider: { height: 1, backgroundColor: Colors.separator, marginBottom: 20 },
  noteContent: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    lineHeight: 26,
    marginBottom: 32,
  },

  statsRow: { flexDirection: 'row', gap: 12 },
  statChip: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 80,
  },
  statValue: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.primaryLight,
  },
  statLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },

  errorText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  backBtnText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
    color: Colors.primaryLight,
  },
});
