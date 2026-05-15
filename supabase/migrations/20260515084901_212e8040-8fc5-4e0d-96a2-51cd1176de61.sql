CREATE TABLE public.app_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE CHECK (platform IN ('ios','android')),
  latest_version TEXT NOT NULL,
  min_version TEXT NOT NULL,
  store_url TEXT NOT NULL,
  force_update BOOLEAN NOT NULL DEFAULT false,
  release_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App versions are publicly readable"
ON public.app_versions FOR SELECT
USING (true);

INSERT INTO public.app_versions (platform, latest_version, min_version, store_url, force_update) VALUES
('ios', '1.0.0', '1.0.0', 'https://apps.apple.com/tr/app/kelimele-online-kelime-oyunu/id6759326006?l=tr', false),
('android', '1.0.0', '1.0.0', 'https://play.google.com/store/apps/details?id=com.ergan.kelimele&hl=tr', false);