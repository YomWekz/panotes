import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use AsyncStorage on native, localStorage on web
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// ── Type helpers ──────────────────────────────────────────────────

export type SupabaseNote = {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  created_at: string;
  updated_at: string;
};

export type SupabaseQuiz = {
  id: string;
  note_id: string;
  user_id: string;
  questions: QuizQuestion[];
  created_at: string;
};

export type QuizQuestion = {
  id: string;
  type: 'multiple_choice' | 'identification';
  question: string;
  options?: string[];         // Only for multiple_choice
  answer: string;
};

export type QuizAttempt = {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  total: number;
  answers: Record<string, string>;
  completed_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  created_at: string;
};
