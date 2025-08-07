import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useDictionaryImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    totalWordsInDatabase?: number;
    newWordsAdded?: number;
    wordsProcessed?: number;
    wordsFromSource?: number;
  } | null>(null);
  const { toast } = useToast();

  const importDictionary = async () => {
    try {
      setIsImporting(true);
      setImportProgress(null);

      toast({
        title: "Sözlük İçe Aktarılıyor",
        description: "Bu işlem birkaç dakika sürebilir...",
      });

      const { data, error } = await supabase.functions.invoke('import-dictionary');

      if (error) {
        throw error;
      }

      if (data.success) {
        setImportProgress(data.statistics);
        toast({
          title: "Sözlük Başarıyla İçe Aktarıldı",
          description: `${data.statistics.newWordsAdded} yeni kelime eklendi. Toplam: ${data.statistics.totalWordsInDatabase} kelime`,
        });
      } else {
        throw new Error(data.error || 'İçe aktarma başarısız');
      }

      return data;
    } catch (error) {
      console.error('Dictionary import error:', error);
      toast({
        title: "Sözlük İçe Aktarma Hatası",
        description: error.message || "Sözlük içe aktarılırken bir hata oluştu",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsImporting(false);
    }
  };

  return {
    importDictionary,
    isImporting,
    importProgress,
  };
};