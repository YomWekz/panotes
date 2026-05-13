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
import { supabase, SupabaseQuiz, QuizQuestion } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { Colors } from '@constants/colors';
import { Typography } from '@constants/typography';

const PASSING_GRADE = 0.8; // 80%

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizTakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [quiz, setQuiz] = useState<SupabaseQuiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [identificationInput, setIdentificationInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchQuiz = async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        const q = data as SupabaseQuiz;
        setQuiz(q);
        setQuestions(shuffle(q.questions));
      }
      setLoading(false);
    };
    fetchQuiz();
  }, [id]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? (currentIndex / totalQuestions) : 0;

  const getCurrentAnswer = () => {
    if (!currentQuestion) return null;
    return answers[currentQuestion.id] ?? null;
  };

  const handleSelectOption = (option: string) => {
    setSelectedOption(option);
  };

  const handleNext = () => {
    if (!currentQuestion) return;

    // Require an answer before proceeding
    const answer = currentQuestion.type === 'multiple_choice'
      ? selectedOption
      : identificationInput.trim();

    if (!answer) return; // blocked

    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

    if (currentIndex < totalQuestions - 1) {
      // Move to next question
      setCurrentIndex(i => i + 1);
      setSelectedOption(null);
      setIdentificationInput('');
    } else {
      // Submit
      handleSubmit(newAnswers);
    }
  };

  const handleSubmit = async (finalAnswers: Record<string, string>) => {
    if (!quiz || !user) return;
    setSubmitting(true);

    // Calculate score
    let score = 0;
    for (const q of questions) {
      const userAnswer = (finalAnswers[q.id] ?? '').toLowerCase().trim();
      const correctAnswer = q.answer.toLowerCase().trim();
      if (userAnswer === correctAnswer) score++;
    }

    // Save attempt
    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: quiz.id,
        user_id: user.id,
        score,
        total: totalQuestions,
        answers: finalAnswers,
      })
      .select()
      .single();

    setSubmitting(false);

    if (!error && attempt) {
      router.replace(`/quiz/results/${attempt.id}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Quiz not found or has no questions.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (submitting) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.submittingText}>Calculating results...</Text>
      </View>
    );
  }

  const canProceed = currentQuestion?.type === 'multiple_choice'
    ? !!selectedOption
    : identificationInput.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity id="quiz-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Quiz</Text>
          <Text style={styles.headerSub}>{currentIndex + 1} / {totalQuestions}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Question Type Badge */}
        <View style={[
          styles.typeBadge,
          currentQuestion.type === 'multiple_choice' ? styles.typeMC : styles.typeID,
        ]}>
          <Text style={styles.typeText}>
            {currentQuestion.type === 'multiple_choice' ? '🔘 Multiple Choice' : '✍️ Identification'}
          </Text>
        </View>

        {/* Question */}
        <Text style={styles.questionText}>{currentQuestion.question}</Text>

        {/* Answer Area */}
        {currentQuestion.type === 'multiple_choice' ? (
          <View style={styles.optionsContainer}>
            {(currentQuestion.options ?? []).map((option, idx) => (
              <TouchableOpacity
                key={idx}
                id={`option-${idx}`}
                style={[
                  styles.optionBtn,
                  selectedOption === option && styles.optionBtnSelected,
                ]}
                onPress={() => handleSelectOption(option)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.optionIndicator,
                  selectedOption === option && styles.optionIndicatorSelected,
                ]}>
                  <Text style={styles.optionLetter}>
                    {['A', 'B', 'C', 'D'][idx]}
                  </Text>
                </View>
                <Text style={[
                  styles.optionText,
                  selectedOption === option && styles.optionTextSelected,
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.identificationContainer}>
            <Text style={styles.identLabel}>Your Answer:</Text>
            <View style={styles.identInputWrapper}>
              <Text
                style={[
                  styles.identInput,
                  identificationInput ? styles.identInputFilled : styles.identInputPlaceholder,
                ]}
                onPress={() => {
                  // React Native TextInput — using native input
                }}
              >
                {identificationInput || 'Type your answer here...'}
              </Text>
            </View>
            {/* We need actual TextInput for identification */}
            <IdentificationInput
              value={identificationInput}
              onChange={setIdentificationInput}
            />
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          id="next-question-btn"
          style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canProceed}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {currentIndex < totalQuestions - 1 ? 'Next →' : 'Submit Quiz ✓'}
          </Text>
        </TouchableOpacity>
        {!canProceed && (
          <Text style={styles.requireAnswerText}>
            {currentQuestion.type === 'multiple_choice'
              ? 'Please select an answer to continue.'
              : 'Please type your answer to continue.'}
          </Text>
        )}
      </View>
    </View>
  );
}

// Inline TextInput for identification questions
import { TextInput } from 'react-native';
function IdentificationInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TextInput
      id="identification-answer"
      style={styles.realIdentInput}
      placeholder="Type your answer here..."
      placeholderTextColor={Colors.textMuted}
      value={value}
      onChangeText={onChange}
      autoCorrect={false}
      autoCapitalize="none"
      returnKeyType="done"
    />
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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  progressBar: {
    height: 4,
    backgroundColor: Colors.bgInput,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  content: { padding: 24, paddingBottom: 32 },

  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 20,
    borderWidth: 1,
  },
  typeMC: { backgroundColor: Colors.primaryGlow, borderColor: Colors.border },
  typeID: { backgroundColor: Colors.accentGlow, borderColor: Colors.accent },
  typeText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },

  questionText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    lineHeight: 30,
    marginBottom: 28,
  },

  // Multiple Choice
  optionsContainer: { gap: 12 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 14,
  },
  optionBtnSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  optionIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIndicatorSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionLetter: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  optionText: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  optionTextSelected: { color: Colors.textPrimary },

  // Identification
  identificationContainer: { gap: 12 },
  identLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  identInputWrapper: { display: 'none' }, // Hidden — using real TextInput below
  identInput: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
  },
  identInputFilled: { color: Colors.textPrimary },
  identInputPlaceholder: { color: Colors.textMuted },
  realIdentInput: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    gap: 8,
  },
  nextBtn: {
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
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  requireAnswerText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
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
  submittingText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    marginTop: 16,
  },
});
