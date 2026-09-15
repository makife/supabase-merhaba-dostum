import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useDictionaryImport } from '@/hooks/useDictionaryImport';
import { Download, Database, CheckCircle } from 'lucide-react';

export const DictionaryImportButton = () => {
  const { importDictionary, isImporting, importProgress } = useDictionaryImport();

  const handleImport = async () => {
    try {
      await importDictionary();
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Türkçe Sözlük
        </CardTitle>
        <CardDescription>
          60-70 bin kelimelik Türkçe sözlük veritabanına ekle
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {importProgress && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              İçe Aktarma Tamamlandı
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Toplam kelime sayısı:</span>
                <span className="font-medium">{importProgress.totalWordsInDatabase?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Yeni eklenen:</span>
                <span className="font-medium text-green-600">{importProgress.newWordsAdded?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>İşlenen kelime:</span>
                <span className="font-medium">{importProgress.wordsProcessed?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {isImporting && (
          <div className="space-y-2">
            <Progress value={undefined} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              Sözlük içe aktarılıyor...
            </p>
          </div>
        )}

        <Button 
          onClick={handleImport}
          disabled={isImporting}
          className="w-full"
          size="lg"
        >
          <Download className="w-4 h-4 mr-2" />
          {isImporting ? 'İçe Aktarılıyor...' : 'Sözlük İçe Aktar'}
        </Button>
      </CardContent>
    </Card>
  );
};