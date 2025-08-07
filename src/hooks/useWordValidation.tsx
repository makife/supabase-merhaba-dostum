import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WordValidationResult {
  isValid: boolean;
  points: number;
  message: string;
}

export const useWordValidation = () => {
  const [isValidating, setIsValidating] = useState(false);

  const validateWord = async (word: string): Promise<WordValidationResult> => {
    if (word.length < 3) {
      return {
        isValid: false,
        points: 0,
        message: 'Kelime en az 3 harf olmalıdır.'
      };
    }

    setIsValidating(true);

    try {
      // Check in local database first
      const { data: dbWord, error } = await supabase
        .from('words')
        .select('*')
        .eq('word', word.toUpperCase())
        .eq('is_approved', true)
        .single();

      if (!error && dbWord) {
        setIsValidating(false);
        return {
          isValid: true,
          points: calculatePoints(word, dbWord.difficulty),
          message: `Doğru! +${calculatePoints(word, dbWord.difficulty)} puan`
        };
      }

      // If not in database, validate via API
      const result = await validateWordOnline(word);
      setIsValidating(false);
      return result;

    } catch (error) {
      console.error('Word validation error:', error);
      setIsValidating(false);
      return {
        isValid: false,
        points: 0,
        message: 'Kelime doğrulanamadı, tekrar deneyin.'
      };
    }
  };

  const validateWordOnline = async (word: string): Promise<WordValidationResult> => {
    try {
      // Call word validation edge function
      const { data, error } = await supabase.functions.invoke('validate-word', {
        body: { word: word.toLowerCase() }
      });

      if (error) throw error;

      if (data.isValid) {
        // Add word to database for future use
        await supabase
          .from('words')
          .upsert({
            word: word.toUpperCase(),
            length: word.length,
            difficulty: data.difficulty || 1,
            is_approved: true
          });

        return {
          isValid: true,
          points: calculatePoints(word, data.difficulty || 1),
          message: `Doğru! +${calculatePoints(word, data.difficulty || 1)} puan`
        };
      } else {
        return {
          isValid: false,
          points: 0,
          message: 'Bu kelime sözlükte bulunmuyor.'
        };
      }
    } catch (error) {
      console.error('Online validation error:', error);
      return {
        isValid: false,
        points: 0,
        message: 'Kelime doğrulanamadı.'
      };
    }
  };

  const calculatePoints = (word: string, difficulty: number = 1): number => {
    const basePoints = word.length * 10;
    const difficultyMultiplier = difficulty;
    return Math.floor(basePoints * difficultyMultiplier);
  };

  return {
    validateWord,
    isValidating
  };
};