-- Message Reports tablosu ve gerekli yapılar

-- Rapor nedenleri için enum
CREATE TYPE public.report_reason AS ENUM (
  'spam',
  'harassment',
  'inappropriate_content',
  'hate_speech',
  'violence',
  'other'
);

-- Rapor durumu için enum
CREATE TYPE public.report_status AS ENUM (
  'pending',
  'reviewed',
  'resolved',
  'dismissed'
);

-- Message Reports tablosu
CREATE TABLE public.message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('global', 'private')),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason report_reason NOT NULL,
  description TEXT,
  status report_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Aynı kişi aynı mesajı birden fazla rapor edemez
  UNIQUE(message_id, reporter_id)
);

-- Indexes
CREATE INDEX idx_message_reports_message_id ON public.message_reports(message_id);
CREATE INDEX idx_message_reports_reporter_id ON public.message_reports(reporter_id);
CREATE INDEX idx_message_reports_status ON public.message_reports(status);
CREATE INDEX idx_message_reports_created_at ON public.message_reports(created_at DESC);

-- RLS Policies
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi raporlarını görebilir
CREATE POLICY "Users can view their own reports"
ON public.message_reports
FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id);

-- Kullanıcılar rapor oluşturabilir
CREATE POLICY "Users can create reports"
ON public.message_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- Otomatik updated_at trigger
CREATE TRIGGER update_message_reports_updated_at
BEFORE UPDATE ON public.message_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Report sayısı tracking için function
CREATE OR REPLACE FUNCTION public.get_message_report_count(p_message_id UUID, p_message_type TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.message_reports
  WHERE message_id = p_message_id 
  AND message_type = p_message_type;
$$;

-- Rapor gönderme rate limit için function
CREATE OR REPLACE FUNCTION public.check_report_rate_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_count INTEGER;
BEGIN
  -- Son 1 saatte kaç rapor gönderilmiş
  SELECT COUNT(*) INTO report_count
  FROM public.message_reports
  WHERE reporter_id = p_user_id
  AND created_at > NOW() - INTERVAL '1 hour';
  
  -- Saatte maksimum 10 rapor
  RETURN report_count < 10;
END;
$$;