import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, QuizAttempt, SupabaseQuiz, QuizQuestion } from '@lib/supabase';
import { Colors } from '@constants/colors';
import { Typography } from '@constants/typography';

const PASSING_GRADE = 0.8; // 80%

export default function QuizResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [quiz, setQuiz] = useState<SupabaseQuiz | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch attempt
      const { data: attemptData, error: attemptError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('id', id)
        .single();

      if (attemptError || !attemptData) {
        setLoading(false);
        return;
      }

      const a = attemptData as QuizAttempt;
      setAttempt(a);

      // Fetch quiz for questions/answers
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', a.quiz_id)
        .single();

      if (quizData) setQuiz(quizData as SupabaseQuiz);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleRetake = () => {
    if (!quiz) return;
    router.replace(`/quiz/${quiz.id}`);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!attempt || !quiz) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Results not found.</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/quiz')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Go to Quizzes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const percentage = attempt.total > 0 ? attempt.score / attempt.total : 0;
  const passed = percentage >= PASSING_GRADE;
  const percentageStr = Math.round(percentage * 100);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          id="results-back-btn"
          onPress={() => router.replace('/(tabs)/quiz')}
          style={styles.backBtn}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Results</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Score Card */}
        <View style={[styles.scoreCard, passed ? styles.scoreCardPass : styles.scoreCardFail]}>
          <Text style={styles.scoreEmoji}>{passed ? '🎉' : '📚'}</Text>
          <Text style={[styles.scorePercent, { color: passed ? Colors.success : Colors.error }]}>
            {percentageStr}%
          </Text>
          <Text style={styles.scoreLabel}>
            {attempt.score} / {attempt.total} correct
          </Text>
          <View style={[styles.statusBadge, passed ? styles.passBadge : styles.failBadge]}>
            <Text style={[styles.statusText, { color: passed ? Colors.success : Colors.error }]}>
              {passed ? '✓ Passed' : '✗ Failed'}
            </Text>
          </View>
          <Text style={styles.passingNote}>
            Passing grade: {Math.round(PASSING_GRADE * 100)}%
          </Text>
        </View>

        {/* Question Breakdown */}
        <Text style={styles.breakdownTitle}>Question Breakdown</Text>
        {quiz.questions.map((question: QuizQuestion, idx: number) => {
          const userAnswer = attempt.answers[question.id] ?? '';
          const isCorrect = userAnswer.toLowerCase().trim() === question.answer.toLowerCase().trim();

          return (
            <View
              key={question.id}
              style={[styles.questionCard, isCorrect ? styles.questionCardCorrect : styles.questionCardWrong]}
            >
              <View style={styles.questionCardHeader}>
                <View style={[
                  styles.questionNumber,
                  isCorrect ? styles.questionNumberCorrect : styles.questionNumberWrong,
                ]}>
                  <Text style={styles.questionNumberText}>{idx + 1}</Text>
                </View>
                <Text style={[styles.questionResult, { color: isCorrect ? Colors.success : Colors.error }]}>
                  {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </Text>
              </View>

              <Text style={styles.questionText}>{question.question}</Text>

              <View style={styles.answerSection}>
                <View style={styles.answerRow}>
                  <Text style={styles.answerLabel}>Your answer:</Text>
                  <Text style={[
                    styles.answerValue,
                    { color: isCorrect ? Colors.success : Colors.error },
                  ]}>
                    {userAnswer || '(no answer)'}
                  </Text>
                </View>
                {!isCorrect && (
                  <View style={styles.answerRow}>
                    <Text style={styles.answerLabel}>Correct answer:</Text>
                    <Text style={[styles.answerValue, { color: Colors.success }]}>
                      {question.answer}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            id="retake-quiz-btn"
            style={styles.retakeBtn}
            onPress={handleRetake}
            activeOpacity={0.85}
          >
            <Text style={styles.retakeBtnText}>🔄 Retake Quiz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            id="goto-quizzes-btn"
            style={styles.quizzesBtn}
            onPress={() => router.replace('/(tabs)/quiz')}
            activeOpacity={0.85}
          >
            <Text style={styles.quizzesBtnText}>← All Quizzes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: 16 },

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
  },
  backArrow: { fontSize: 18, color: Colors.textPrimary },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },

  content: { padding: 20, paddingBottom: 60 },

  // Score Card
  scoreCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
  },
  scoreCardPass: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.success,
  },
  scoreCardFail: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.error,
  },
  scoreEmoji: { fontSize: 52, marginBottom: 12 },
  scorePercent: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 56,
    marginBottom: 4,
  },
  scoreLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  passBadge: { backgroundColor: Colors.successBg, borderColor: Colors.success },
  failBadge: { backgroundColor: Colors.errorBg, borderColor: Colors.error },
  statusText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.base,
    letterSpacing: Typography.letterSpacing.wide,
  },
  passingNote: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },

  // Breakdown
  breakdownTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  questionCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  questionCardCorrect: {
    backgroundColor: Colors.successBg,
    borderColor: 'rgba(37, 143, 41, 0.3)',
  },
  questionCardWrong: {
    backgroundColor: Colors.errorBg,
    borderColor: 'rgba(237, 0, 0, 0.3)',
  },
  questionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  questionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionNumberCorrect: { backgroundColor: Colors.success },
  questionNumberWrong: { backgroundColor: Colors.error },
  questionNumberText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
  },
  questionResult: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
  },
  questionText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    marginBottom: 12,
    lineHeight: 20,
  },
  answerSection: { gap: 6 },
  answerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  answerLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  answerValue: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    flexShrink: 1,
  },

  // Actions
  actions: { gap: 12, marginTop: 8 },
  retakeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  retakeBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  quizzesBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quizzesBtnText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
  },

  errorText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
  },
  backBtnText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
    color: Colors.primaryLight,
  },
});
