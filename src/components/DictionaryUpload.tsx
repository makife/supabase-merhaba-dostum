import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, FileText, CheckCircle } from 'lucide-react';

export const DictionaryUpload = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState<{
    totalWords?: number;
    newWords?: number;
    duplicates?: number;
  } | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files?.[0]) return;

    const file = event.target.files[0];
    
    // Validate file type
    if (!file.name.endsWith('.txt')) {
      toast({
        title: 'Geçersiz Dosya',
        description: 'Lütfen .txt formatında bir dosya seçin.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(10);

      // Upload file to storage
      const fileName = `${user.id}/dictionary_${Date.now()}.txt`;
      const { error: uploadError } = await supabase.storage
        .from('dictionaries')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      setUploadProgress(50);

      // Process the uploaded file
      const { data, error } = await supabase.functions.invoke('process-dictionary', {
        body: { fileName }
      });

      if (error) {
        throw error;
      }

      setUploadProgress(100);
      setUploadStats(data.statistics);

      toast({
        title: 'Sözlük Başarıyla Yüklendi',
        description: `${data.statistics.newWords} yeni kelime eklendi.`,
      });

      // Clean up uploaded file
      await supabase.storage
        .from('dictionaries')
        .remove([fileName]);

    } catch (error) {
      console.error('Dictionary upload error:', error);
      toast({
        title: 'Yükleme Hatası',
        description: error.message || 'Dosya yüklenirken bir hata oluştu',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Sözlük Dosyası Yükle
        </CardTitle>
        <CardDescription>
          .txt formatında kelime listesi yükleyerek sözlüğü genişletin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {uploadStats && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Yükleme Tamamlandı
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Toplam kelime:</span>
                <span className="font-medium">{uploadStats.totalWords?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Yeni kelime:</span>
                <span className="font-medium text-green-600">{uploadStats.newWords?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Zaten mevcut:</span>
                <span className="font-medium text-yellow-600">{uploadStats.duplicates?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              Sözlük işleniyor... ({uploadProgress}%)
            </p>
          </div>
        )}

        <div className="space-y-2">
          <input
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
            id="dictionary-upload"
          />
          <label htmlFor="dictionary-upload">
            <Button 
              asChild
              disabled={isUploading}
              className="w-full cursor-pointer"
              size="lg"
            >
              <span>
                <Upload className="w-4 h-4 mr-2" />
                {isUploading ? 'Yükleniyor...' : 'Dosya Seç'}
              </span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground text-center">
            Her satırda bir kelime olacak şekilde .txt dosyası yükleyin
          </p>
        </div>
      </CardContent>
    </Card>
  );
};