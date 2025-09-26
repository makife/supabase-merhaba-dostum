import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

export const TestDailyReset = () => {
  const [testing, setTesting] = useState(false);

  const testDailyReset = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-daily-reset');
      
      if (error) {
        toast.error('Test başarısız: ' + error.message);
      } else {
        toast.success('Günlük reset testi başarılı! Veriler sıfırlandı.');
        console.log('Test result:', data);
      }
    } catch (error) {
      toast.error('Test hatası: ' + (error as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Button 
      onClick={testDailyReset} 
      disabled={testing}
      variant="outline"
      size="sm"
    >
      {testing ? 'Test Ediliyor...' : '🧪 Günlük Reset Test'}
    </Button>
  );
};