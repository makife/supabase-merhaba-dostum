import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertCircle, Ban, CheckCircle, Clock, MessageSquare, Shield, ArrowLeft, Bell, Send, Loader2, Megaphone, Trash2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { usePageResync } from '@/hooks/useGlobalResync';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MessageReport {
  id: string;
  message_id: string;
  message_type: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  message_content?: string;
  reporter_username?: string;
  reported_username?: string;
}

interface UserBan {
  id: string;
  user_id: string;
  reason: string;
  banned_until: string;
  banned_at: string;
  is_active: boolean;
  username?: string;
}

const ModeratorPage = () => {
  const { user } = useAuth();
  const { isSystemConnected } = useUser();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [bans, setBans] = useState<UserBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<MessageReport | null>(null);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banDuration, setBanDuration] = useState<string>("48");
  
  // Push bildirim state
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushSending, setPushSending] = useState(false);

  // Sistem mesajı state
  const [sysTitle, setSysTitle] = useState('');
  const [sysBody, setSysBody] = useState('');
  const [sysSending, setSysSending] = useState(false);
  const [systemMessages, setSystemMessages] = useState<any[]>([]);

  const fetchSystemMessages = useCallback(async () => {
    const { data } = await supabase
      .from('system_messages' as any)
      .select('id,title,body,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setSystemMessages((data as any) || []);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchSystemMessages();
  }, [isAdmin, fetchSystemMessages]);

  const handleSendSystemMessage = async () => {
    if (!sysTitle.trim() || !sysBody.trim()) {
      toast.error('Başlık ve konu alanları boş olamaz');
      return;
    }
    setSysSending(true);
    try {
      const { error } = await supabase.from('system_messages' as any).insert({
        title: sysTitle.trim(),
        body: sysBody.trim(),
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast.success('Sistem mesajı tüm kullanıcılara gönderildi ✅');
      setSysTitle('');
      setSysBody('');
      fetchSystemMessages();
    } catch (e) {
      console.error('System message error', e);
      toast.error('Sistem mesajı gönderilemedi');
    } finally {
      setSysSending(false);
    }
  };

  const handleDeleteSystemMessage = async (id: string) => {
    try {
      const { error } = await supabase.from('system_messages' as any).delete().eq('id', id);
      if (error) throw error;
      toast.success('Sistem mesajı silindi');
      fetchSystemMessages();
    } catch (e) {
      console.error('Delete system message error', e);
      toast.error('Silinemedi');
    }
  };

  // Ana resync fonksiyonu
  const handleModeratorResync = useCallback(async () => {
    await Promise.all([fetchReports(), fetchBans()]);
  }, []);

  // 🔄 Global Resync Hook - bağlantı kopup geldiğinde otomatik tazele
  usePageResync(handleModeratorResync, 'ModeratorPage', true);

  useEffect(() => {
    fetchReports();
    fetchBans();

    // Realtime subscription for new reports
    const reportChannel = supabase
      .channel('moderator-reports')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reports'
      }, () => {
        fetchReports();
        toast.info('Yeni şikayet raporu alındı');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reportChannel);
    };
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('message_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reportsData = data || [];

      // Kullanıcı adlarını profillerden topla (FK olmadığından ayrı sorgu)
      const userIds = Array.from(new Set(
        reportsData.flatMap((r: any) => [r.reporter_id, r.reported_user_id]).filter(Boolean)
      ));

      let usernameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);
        usernameMap = (profiles || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.username;
          return acc;
        }, {});
      }

      const formattedReports = reportsData.map((report: any) => ({
        ...report,
        reporter_username: usernameMap[report.reporter_id] || 'Bilinmiyor',
        reported_username: usernameMap[report.reported_user_id] || 'Bilinmiyor',
      }));

      setReports(formattedReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Raporlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchBans = async () => {
    try {
      const { data, error } = await supabase
        .from('user_bans')
        .select('*')
        .eq('is_active', true)
        .order('banned_at', { ascending: false });

      if (error) throw error;

      const bansData = data || [];
      const userIds = Array.from(new Set(bansData.map((b: any) => b.user_id).filter(Boolean)));

      let usernameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);
        usernameMap = (profiles || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.username;
          return acc;
        }, {});
      }

      const formattedBans = bansData.map((ban: any) => ({
        ...ban,
        username: usernameMap[ban.user_id] || 'Bilinmiyor',
      }));

      setBans(formattedBans);
    } catch (error) {
      console.error('Error fetching bans:', error);
    }
  };

  const handleBanUser = async () => {
    if (!selectedReport || !user) return;

    try {
      // RPC fonksiyonu kullanarak ban uygula (bildirim otomatik gönderilir)
      const { data, error } = await supabase.rpc('apply_moderator_ban', {
        p_user_id: selectedReport.reported_user_id,
        p_reason: selectedReport.reason,
        p_description: selectedReport.description || '',
        p_duration_hours: parseInt(banDuration),
        p_moderator_id: user.id
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        toast.error(result.error || 'Yasaklama başarısız');
        return;
      }

      await updateReportStatus(selectedReport.id, 'resolved');
      
      toast.success('Kullanıcı yasaklandı ve bildirim gönderildi');
      setBanDialogOpen(false);
      setSelectedReport(null);
      fetchBans();
    } catch (error) {
      console.error('Error banning user:', error);
      toast.error('Yasaklama sırasında hata oluştu');
    }
  };

  const updateReportStatus = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      const { error } = await supabase
        .from('message_reports')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;

      await fetchReports();
      toast.success(`Rapor ${status === 'resolved' ? 'çözüldü' : 'reddedildi'}`);
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error('Rapor güncellenirken hata oluştu');
    }
  };

  const removeBan = async (banId: string) => {
    if (!user) return;
    
    try {
      // RPC fonksiyonu kullanarak yasak kaldır (bildirim otomatik gönderilir)
      const { data, error } = await supabase.rpc('remove_moderator_ban', {
        p_ban_id: banId,
        p_moderator_id: user.id
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        toast.error(result.error || 'Yasak kaldırılamadı');
        return;
      }

      toast.success('Yasak kaldırıldı ve kullanıcıya bildirim gönderildi');
      fetchBans();
    } catch (error) {
      console.error('Error removing ban:', error);
      toast.error('Yasak kaldırılırken hata oluştu');
    }
  };

  // Push bildirim gönderme (sadece admin)
  const handleBroadcastPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) {
      toast.error('Başlık ve mesaj alanları boş olamaz');
      return;
    }
    setPushSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-broadcast-notification', {
        body: { title: pushTitle.trim(), body: pushBody.trim() }
      });
      if (error) throw error;
      toast.success(`Bildirim gönderildi! ✅ (${data?.sent || 0} kişiye ulaştı, ${data?.failed || 0} başarısız)`);
      setPushTitle('');
      setPushBody('');
    } catch (error) {
      console.error('Broadcast push error:', error);
      toast.error('Bildirim gönderilirken hata oluştu');
    } finally {
      setPushSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="w-3 h-3 mr-1" />Beklemede</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Çözüldü</Badge>;
      case 'dismissed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><AlertCircle className="w-3 h-3 mr-1" />Reddedildi</Badge>;
      default:
        return null;
    }
  };

  const getReasonBadge = (reason: string) => {
    const colors: Record<string, string> = {
      spam: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      harassment: 'bg-red-500/10 text-red-500 border-red-500/20',
      inappropriate: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      offensive: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
      other: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    };
    
    return <Badge variant="outline" className={colors[reason] || colors.other}>{reason}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Moderatör Paneli</h1>
            <p className="text-muted-foreground">Raporları yönetin ve kullanıcı yasaklarını kontrol edin</p>
          </div>
        </div>

        <Tabs defaultValue="reports" className="space-y-4">
          <TabsList className="flex flex-wrap gap-2 w-full h-auto bg-transparent p-0">
            <TabsTrigger
              value="reports"
              className="gap-1.5 px-3 py-2 rounded-xl border-2 border-amber-500/30 bg-amber-500/10 text-amber-400 data-[state=active]:bg-amber-500 data-[state=active]:text-black data-[state=active]:border-amber-500 shadow-sm text-xs font-bold uppercase tracking-wide"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Raporlar ({reports.filter(r => r.status === 'pending').length})
            </TabsTrigger>
            <TabsTrigger
              value="bans"
              className="gap-1.5 px-3 py-2 rounded-xl border-2 border-red-500/30 bg-red-500/10 text-red-400 data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=active]:border-red-500 shadow-sm text-xs font-bold uppercase tracking-wide"
            >
              <Ban className="w-3.5 h-3.5" />
              Yasaklar ({bans.length})
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="push"
                className="gap-1.5 px-3 py-2 rounded-xl border-2 border-sky-500/30 bg-sky-500/10 text-sky-400 data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:border-sky-500 shadow-sm text-xs font-bold uppercase tracking-wide"
              >
                <Bell className="w-3.5 h-3.5" />
                Push Bildirim
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger
                value="system"
                className="gap-1.5 px-3 py-2 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:border-emerald-500 shadow-sm text-xs font-bold uppercase tracking-wide"
              >
                <Megaphone className="w-3.5 h-3.5" />
                Sistem Mesajları
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="reports" className="space-y-4">
            {reports.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Henüz şikayet raporu yok</p>
                </CardContent>
              </Card>
            ) : (
              reports.map((report) => (
                <Card key={report.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {report.reporter_username} → {report.reported_username} hakkında şikayet
                        </CardTitle>
                        <CardDescription>
                          {new Date(report.created_at).toLocaleString('tr-TR')}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {getReasonBadge(report.reason)}
                        {getStatusBadge(report.status)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {report.description && (
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm font-medium mb-1">Açıklama:</p>
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      </div>
                    )}
                    
                    <div className="bg-muted/30 p-3 rounded-lg border border-border">
                      <p className="text-sm font-medium mb-1">Mesaj Tipi:</p>
                      <p className="text-sm text-muted-foreground">
                        {report.message_type === 'global' ? 'Global Chat' : 'Özel Mesaj'}
                      </p>
                    </div>

                    {report.status === 'pending' && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setSelectedReport(report);
                            setBanDialogOpen(true);
                          }}
                          className="gap-2 w-full sm:w-auto text-sm"
                          size="sm"
                        >
                          <Ban className="w-4 h-4" />
                          Kullanıcıyı Yasakla
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => updateReportStatus(report.id, 'dismissed')}
                          className="w-full sm:w-auto text-sm"
                          size="sm"
                        >
                          Reddet
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => updateReportStatus(report.id, 'resolved')}
                          className="gap-2 w-full sm:w-auto text-sm"
                          size="sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Çözüldü İşaretle
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="bans" className="space-y-4">
            {bans.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Ban className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aktif yasak yok</p>
                </CardContent>
              </Card>
            ) : (
              bans.map((ban) => (
                <Card key={ban.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{ban.username}</CardTitle>
                        <CardDescription>
                          Yasaklandı: {new Date(ban.banned_at).toLocaleString('tr-TR')}
                        </CardDescription>
                      </div>
                      <Badge variant="destructive">Yasaklı</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm font-medium mb-1">Sebep:</p>
                      <p className="text-sm text-muted-foreground">{ban.reason}</p>
                    </div>
                    
                    <div className="bg-muted/30 p-3 rounded-lg border border-border">
                      <p className="text-sm font-medium mb-1">Yasak Bitiş:</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(ban.banned_until).toLocaleString('tr-TR')}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => removeBan(ban.id)}
                      className="gap-2 w-full sm:w-auto"
                      size="sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Yasakı Kaldır
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Push Bildirim Tab - Sadece Admin */}
          {isAdmin && (
            <TabsContent value="push" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Toplu Push Bildirim Gönder
                  </CardTitle>
                  <CardDescription>
                    Tüm kullanıcılara aynı anda push bildirim gönderin. Push token'ı olan tüm kullanıcılara ulaşır.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="push-title">Bildirim Başlığı</Label>
                    <Input
                      id="push-title"
                      placeholder="Örn: 🎉 Yeni Güncelleme!"
                      value={pushTitle}
                      onChange={(e) => setPushTitle(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="push-body">Bildirim Mesajı</Label>
                    <Textarea
                      id="push-body"
                      placeholder="Örn: Yeni özellikler eklendi, hemen gelin oynayın!"
                      value={pushBody}
                      onChange={(e) => setPushBody(e.target.value)}
                      maxLength={500}
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleBroadcastPush}
                    disabled={pushSending || !pushTitle.trim() || !pushBody.trim()}
                    className="w-full gap-2"
                  >
                    {pushSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Tüm Kullanıcılara Gönder
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Sistem Mesajları Tab - Sadece Admin */}
          {isAdmin && (
            <TabsContent value="system" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5" />
                    Sistem Mesajı Yayınla
                  </CardTitle>
                  <CardDescription>
                    Yazdığınız mesaj tüm kullanıcıların ana sayfasındaki bildirim ikonunda kırmızı rozet olarak görünür.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sys-title">Başlık</Label>
                    <Input
                      id="sys-title"
                      placeholder="Örn: Yeni güncelleme!"
                      value={sysTitle}
                      onChange={(e) => setSysTitle(e.target.value)}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sys-body">Konu</Label>
                    <Textarea
                      id="sys-body"
                      placeholder="Mesaj içeriği..."
                      value={sysBody}
                      onChange={(e) => setSysBody(e.target.value)}
                      maxLength={1000}
                      rows={5}
                    />
                  </div>
                  <Button
                    onClick={handleSendSystemMessage}
                    disabled={sysSending || !sysTitle.trim() || !sysBody.trim()}
                    className="w-full gap-2"
                  >
                    {sysSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Yayınlanıyor...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Yayınla
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Yayınlanan Mesajlar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {systemMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Henüz sistem mesajı yok
                    </p>
                  ) : (
                    systemMessages.map((m) => (
                      <div
                        key={m.id}
                        className="border border-border rounded-lg p-3 space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm">{m.title}</h4>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDeleteSystemMessage(m.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {m.body}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(m.created_at).toLocaleString('tr-TR')}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcıyı Yasakla</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                {selectedReport?.reported_username} kullanıcısını yasaklamak istediğinize emin misiniz?
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Yasak Süresi</label>
                <Select value={banDuration} onValueChange={setBanDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 Saat</SelectItem>
                    <SelectItem value="48">48 Saat (2 Gün)</SelectItem>
                    <SelectItem value="72">72 Saat (3 Gün)</SelectItem>
                    <SelectItem value="168">1 Hafta</SelectItem>
                    <SelectItem value="720">30 Gün (1 Ay)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBanUser} className="bg-destructive hover:bg-destructive/90">
              Yasakla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ModeratorPage;
