import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bot, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

interface GenerationStats {
  generatedWords: number;
  newWordsAdded: number;
  category: string;
  totalInDatabase: number;
  difficulty: number;
  generatedWordsList?: string[];
}

export const AIWordGenerator = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [category, setCategory] = useState('genel');
  const [count, setCount] = useState(50);
  const [difficulty, setDifficulty] = useState(2);

  const categories = [
    { value: 'genel', label: 'Genel Kelimeler', description: 'Karışık Türkçe kelimeler' },
    { value: 'hayvanlar', label: 'Hayvanlar', description: 'Hayvan isimleri' },
    { value: 'yemekler', label: 'Yemekler', description: 'Yiyecek ve içecekler' },
    { value: 'meslekler', label: 'Meslekler', description: 'Meslek isimleri' },
    { value: 'objeler', label: 'Objeler', description: 'Günlük eşyalar' },
    { value: 'fiiller', label: 'Fiiller', description: 'Eylem kelimeleri' },
    { value: 'sıfatlar', label: 'Sıfatlar', description: 'Özellik bildiren kelimeler' },
    { value: 'renkler', label: 'Renkler', description: 'Renk isimleri' },
    { value: 'doğa', label: 'Doğa', description: 'Doğa ile ilgili kelimeler' },
  ];

  const difficultyLevels = [
    { value: 1, label: 'Çok Kolay', description: '3-4 harf' },
    { value: 2, label: 'Kolay', description: '4-6 harf' },
    { value: 3, label: 'Orta', description: '6-8 harf' },
    { value: 4, label: 'Zor', description: '8-10 harf' },
    { value: 5, label: 'Çok Zor', description: '10+ harf' },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStats(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-turkish-words', {
        body: {
          category,
          count,
          minLength: 3,
          maxLength: difficulty <= 2 ? 8 : difficulty <= 4 ? 12 : 15,
          difficulty
        }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Kelime üretimi başarısız');
      }

      setStats(data.statistics);
      
      toast({
        title: 'Başarılı!',
        description: `${data.statistics.newWordsAdded} yeni kelime eklendi`,
      });

    } catch (error) {
      console.error('AI word generation error:', error);
      toast({
        title: 'Hata',
        description: 'Kelime üretimi sırasında hata oluştu',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedCategory = categories.find(cat => cat.value === category);
  const selectedDifficulty = difficultyLevels.find(diff => diff.value === difficulty);

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          AI Kelime Üretici
        </CardTitle>
        <CardDescription>
          OpenAI ile kategorik Türkçe kelime üretimi
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Kategori Seçimi */}
        <div className="space-y-3">
          <Label htmlFor="category">Kategori</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Kategori seçin" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{cat.label}</span>
                    <span className="text-xs text-muted-foreground">{cat.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Zorluk Seviyesi */}
        <div className="space-y-3">
          <Label htmlFor="difficulty">Zorluk Seviyesi</Label>
          <Select value={difficulty.toString()} onValueChange={(value) => setDifficulty(parseInt(value))}>
            <SelectTrigger>
              <SelectValue placeholder="Zorluk seçin" />
            </SelectTrigger>
            <SelectContent>
              {difficultyLevels.map((level) => (
                <SelectItem key={level.value} value={level.value.toString()}>
                  <div className="flex flex-col">
                    <span className="font-medium">{level.label}</span>
                    <span className="text-xs text-muted-foreground">{level.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kelime Sayısı */}
        <div className="space-y-3">
          <Label htmlFor="count">Üretilecek Kelime Sayısı</Label>
          <Input
            id="count"
            type="number"
            min="10"
            max="200"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 50)}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            10-200 arası değer girin
          </p>
        </div>

        {/* Seçim Özeti */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">Üretim Özeti:</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{selectedCategory?.label}</Badge>
            <Badge variant="outline">{selectedDifficulty?.label}</Badge>
            <Badge variant="outline">{count} kelime</Badge>
          </div>
        </div>

        {/* Progress */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm">AI kelime üretiyor...</span>
            </div>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {/* İstatistikler */}
        {stats && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Üretim Tamamlandı
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span>Kategori:</span>
                <span className="font-medium capitalize">{stats.category}</span>
              </div>
              <div className="flex justify-between">
                <span>Zorluk:</span>
                <span className="font-medium">{stats.difficulty}/5</span>
              </div>
              <div className="flex justify-between">
                <span>Üretilen:</span>
                <span className="font-medium">{stats.generatedWords}</span>
              </div>
              <div className="flex justify-between">
                <span>Yeni eklenen:</span>
                <span className="font-medium text-green-600">{stats.newWordsAdded}</span>
              </div>
              <div className="flex justify-between col-span-2">
                <span>Toplam veritabanı:</span>
                <span className="font-medium">{stats.totalInDatabase?.toLocaleString()}</span>
              </div>
            </div>
            
            {/* Örnek kelimeler */}
            {stats.generatedWordsList && stats.generatedWordsList.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-medium text-sm">Örnek Kelimeler:</h5>
                <div className="flex flex-wrap gap-1">
                  {stats.generatedWordsList.slice(0, 8).map((word, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {word}
                    </Badge>
                  ))}
                  {stats.generatedWordsList.length > 8 && (
                    <Badge variant="outline" className="text-xs">
                      +{stats.generatedWordsList.length - 8} daha
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Uyarı */}
        <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <p className="font-medium">Not:</p>
            <p>AI tarafından üretilen kelimeler gerçek Türkçe sözlükten kontrol edilir. Sadece geçerli kelimeler eklenir.</p>
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full"
          size="lg"
        >
          <Bot className="w-4 h-4 mr-2" />
          {isGenerating ? 'Üretiliyor...' : 'AI ile Kelime Üret'}
        </Button>
      </CardContent>
    </Card>
  );
};