
CREATE TABLE public.system_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_messages TO authenticated;
GRANT ALL ON public.system_messages TO service_role;
ALTER TABLE public.system_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read system_messages" ON public.system_messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert system_messages" ON public.system_messages
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update system_messages" ON public.system_messages
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete system_messages" ON public.system_messages
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.system_message_reads (
  user_id UUID NOT NULL,
  message_id UUID NOT NULL REFERENCES public.system_messages(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);
GRANT SELECT, INSERT, DELETE ON public.system_message_reads TO authenticated;
GRANT ALL ON public.system_message_reads TO service_role;
ALTER TABLE public.system_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own read records select" ON public.system_message_reads
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own read records insert" ON public.system_message_reads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own read records delete" ON public.system_message_reads
  FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.system_messages;
