import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, SupabaseNote, SupabaseQuiz } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { Colors } from '@constants/colors';
import { Typography } from '@constants/typography';

const MIN_SUBJECT_LENGTH = 100;

type NoteWithQuiz = SupabaseNote & { quiz?: SupabaseQuiz };

export default function QuizScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notesWithQuizzes, setNotesWithQuizzes] = useState<NoteWithQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Fetch notes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (notesError || !notes) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Fetch quizzes for all notes in one call
    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('*')
      .eq('user_id', user.id);

    // Merge
    const quizMap = new Map((quizzes ?? []).map((q: SupabaseQuiz) => [q.note_id, q]));
    const merged = (notes as SupabaseNote[]).map(note => ({
      ...note,
      quiz: quizMap.get(note.id) as SupabaseQuiz | undefined,
    }));

    setNotesWithQuizzes(merged);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleTakeQuiz = (item: NoteWithQuiz) => {
    if (!item.quiz) return;
    router.push(`/quiz/${item.quiz.id}`);
  };

  const handleAddDetails = (item: NoteWithQuiz) => {
    router.push(`/note/edit/${item.id}`);
  };

  const handleRetryGenerate = async (item: NoteWithQuiz) => {
    if (!user || generatingFor) return;
    setGeneratingFor(item.id);
    try {
      const { error } = await supabase.functions.invoke('generate-quiz', {
        body: { note_id: item.id, title: item.title, subject: item.subject, user_id: user.id },
      });
      if (!error) await fetchData();
    } catch (e) {
      console.warn('[Quiz] Retry failed:', e);
    } finally {
      setGeneratingFor(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>panotes</Text>
        <Text style={styles.screenTitle}>🧠 Quiz Section</Text>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
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
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
        ) : notesWithQuizzes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🧠</Text>
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptySubtitle}>
              Create notes in the Notes tab to generate quizzes.
            </Text>
          </View>
        ) : (
          notesWithQuizzes.map((item) => {
            const hasSufficientContent = item.subject.length >= MIN_SUBJECT_LENGTH;
            const hasQuiz = !!item.quiz;
            const isGenerating = generatingFor === item.id;

            return (
              <View key={item.id} style={styles.quizCard}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                    {hasQuiz && (
                      <View style={styles.quizReadyBadge}>
                        <Text style={styles.quizReadyText}>Quiz Ready</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardPreview} numberOfLines={2}>
                    {item.subject}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {item.subject.length} chars •{' '}
                    {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>

                {/* Card Action */}
                <View style={styles.cardAction}>
                  {!hasSufficientContent ? (
                    // Not enough content → Add Details
                    <TouchableOpacity
                      id={`add-details-${item.id}`}
                      style={styles.addDetailsBtn}
                      onPress={() => handleAddDetails(item)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.addDetailsBtnText}>✏️ Add Details</Text>
                    </TouchableOpacity>
                  ) : isGenerating ? (
                    <View style={styles.generatingRow}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.generatingText}>Generating quiz...</Text>
                    </View>
                  ) : !hasQuiz ? (
                    // Content OK but no quiz yet → retry
                    <TouchableOpacity
                      id={`retry-quiz-${item.id}`}
                      style={styles.retryBtn}
                      onPress={() => handleRetryGenerate(item)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.retryBtnText}>⚡ Generate Quiz</Text>
                    </TouchableOpacity>
                  ) : (
                    // Has quiz → Take Quiz
                    <TouchableOpacity
                      id={`take-quiz-${item.id}`}
                      style={styles.takeQuizBtn}
                      onPress={() => handleTakeQuiz(item)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.takeQuizBtnText}>▶ Take Quiz</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  topBar: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  appTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.textPrimary,
    letterSpacing: Typography.letterSpacing.tight,
    marginBottom: 2,
  },
  screenTitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },

  list: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 100 },

  // Quiz Card
  quizCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: { padding: 16, paddingBottom: 12 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  quizReadyBadge: {
    backgroundColor: Colors.accentGlow,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  quizReadyText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.accent,
  },
  cardPreview: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardMeta: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },

  cardAction: {
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    padding: 12,
  },

  // Buttons
  takeQuizBtn: {
    backgroundColor: '#258F29',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#258F29',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  takeQuizBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    letterSpacing: Typography.letterSpacing.wide,
  },
  addDetailsBtn: {
    backgroundColor: '#BDAD00',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#BDAD00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addDetailsBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textInverse,
    letterSpacing: Typography.letterSpacing.wide,
  },
  retryBtn: {
    backgroundColor: Colors.primaryGlow,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.primaryLight,
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  generatingText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
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
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },
});
