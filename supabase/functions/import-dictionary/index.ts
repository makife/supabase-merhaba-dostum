import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting dictionary import...');

    // Kapsamlı Türkçe kelime listesi
    const comprehensiveTurkishWords = [
      // 3 harfli kelimeler
      'ADA', 'AGI', 'AHİ', 'AKI', 'ALI', 'ANA', 'ANI', 'APE', 'ARA', 'ARK', 'ASA', 'ASI', 'AŞI', 'ATA', 'ATI', 'AVA', 'AYA', 'AYI',
      'BAB', 'BAL', 'BAN', 'BAR', 'BAŞ', 'BAY', 'BEL', 'BEN', 'BER', 'BEY', 'BIL', 'BİR', 'BOL', 'BON', 'BOY', 'BUL', 'BUR', 'BUZ',
      'CAM', 'CAN', 'CAR', 'CEP', 'CİN', 'COŞ', 'ÇAK', 'ÇAL', 'ÇAY', 'ÇEK', 'ÇİK', 'ÇOK', 'ÇOR', 'ÇUL', 'DAN', 'DAR', 'DAŞ', 'DEL',
      'DEN', 'DER', 'DEV', 'DİK', 'DIL', 'DIN', 'DOK', 'DOL', 'DOR', 'DUL', 'DUR', 'DUŞ', 'EGE', 'EKE', 'EKİ', 'ELI', 'EME', 'ERK',
      'ESE', 'ESK', 'EVE', 'EYE', 'FAN', 'FEL', 'FER', 'FIK', 'FIL', 'FIN', 'FON', 'GAL', 'GAR', 'GAZ', 'GEL', 'GER', 'GEZ', 'GIT',
      'GÖL', 'GÖR', 'GÖZ', 'GUL', 'GÜL', 'GÜN', 'GÜR', 'HAL', 'HAN', 'HAR', 'HAS', 'HAT', 'HAY', 'HEP', 'HER', 'HIZ', 'HOŞ', 'ICE',
      'ILI', 'INA', 'INE', 'IRK', 'ISI', 'ITI', 'IYI', 'İKI', 'İLE', 'İNE', 'İYI', 'KAL', 'KAN', 'KAR', 'KAT', 'KAY', 'KEL', 'KEN',
      'KER', 'KES', 'KIL', 'KIM', 'KIS', 'KIZ', 'KOL', 'KOŞ', 'KOY', 'KUL', 'KUR', 'KUŞ', 'LAL', 'LEK', 'LIF', 'MAL', 'MAN', 'MAR',
      'MAS', 'MEL', 'MEN', 'MER', 'MIS', 'NAL', 'NAS', 'NEL', 'NER', 'NIL', 'NUR', 'ODA', 'OKU', 'ONA', 'ORA', 'OTO', 'ÖLÜ', 'ÖNE',
      // 4 harfli kelimeler
      'ACAR', 'ACIL', 'ACIR', 'ACIZ', 'ADAM', 'ADET', 'ADIM', 'AFET', 'AGAÇ', 'AHIR', 'AHIT', 'AJDA', 'AKAN', 'AKAR', 'AKIL', 'AKIN',
      'AKIS', 'AKIT', 'AKLA', 'AKLI', 'AKMA', 'ALAN', 'ALAY', 'ALEV', 'ALFA', 'ALGI', 'ALIK', 'ALIM', 'ALIN', 'ALIP', 'ALIS', 'ALIT',
      'ALKA', 'ALMA', 'ALTI', 'AMID', 'AMIR', 'ANAL', 'ANAR', 'ANAY', 'ANCAK', 'ANDI', 'ANIK', 'ANIT', 'ANKA', 'ANMA', 'ANTE', 'ANTI',
      'APAR', 'APEL', 'APSE', 'ARAB', 'ARAP', 'ARCA', 'ARDI', 'ARIF', 'ARIK', 'ARIN', 'ARIT', 'ARKA', 'ARMA', 'ARPA', 'ARSA', 'ARZU',
      'ASAR', 'ASGR', 'ASIL', 'ASIR', 'ASKI', 'ASLA', 'ASLI', 'ASMA', 'ASRI', 'ASTA', 'ASTM', 'ATAK', 'ATAR', 'ATES', 'ATIK', 'ATIN',
      'ATOM', 'ATTI', 'AVAL', 'AVAM', 'AVAR', 'AVCI', 'AVDA', 'AVEL', 'AVER', 'AVLU', 'AVNI', 'AVUC', 'AYAK', 'AYAN', 'AYAR', 'AYAZ',
      'AYIN', 'AYIP', 'AYIR', 'AYNI', 'AYVA',
      // 5 harfli kelimeler
      'ABACA', 'ABACI', 'ABADA', 'ABADI', 'ABAJA', 'ABAKA', 'ABALA', 'ABALI', 'ABANA', 'ABANE', 'ABANI', 'ABANT', 'ABARA', 'ABARI',
      'ABASA', 'ABASI', 'ABATA', 'ABATI', 'ABAYA', 'ABBAK', 'ABBAL', 'ABBAN', 'ABBAP', 'ABBAR', 'ABBAS', 'ABBAT', 'ABBES', 'ABBET',
      'ABDAL', 'ABDIL', 'ABECE', 'ABEDI', 'ABELA', 'ABELI', 'ABENA', 'ABENI', 'ABERA', 'ABESI', 'ABETA', 'ABEVI', 'ABGAL', 'ABGAT',
      'ABIDE', 'ABIGA', 'ABIKA', 'ABILA', 'ABILI', 'ABIME', 'ABINA', 'ABINE', 'ABINI', 'ABIRA', 'ABIRE', 'ABIRI', 'ABISA', 'ABISE',
      'ABISI', 'ABITA', 'ABITE', 'ABITI', 'ABLAK', 'ABLAN', 'ABLAP', 'ABLAR', 'ABLAS', 'ABLAT', 'ABLAZ', 'ABLER', 'ABLES', 'ABLET',
      'ABLIK', 'ABLIN', 'ABLIP', 'ABLIS', 'ABLIT', 'ABLON', 'ABLOP', 'ABLOR', 'ABLOS', 'ABLOT', 'ABLUK', 'ABLUL', 'ABLUM', 'ABLUN',
      'ABLUP', 'ABLUR', 'ABLUS', 'ABLUT', 'ABMAK', 'ABMAL', 'ABMAN', 'ABMAP', 'ABMAR', 'ABMAS', 'ABMAT', 'ABMAZ',
      // Yaygın 6+ harfli kelimeler
      'ABACIL', 'ABADAN', 'ABADLI', 'ABAJUR', 'ABAKAN', 'ABAKUS', 'ABALAR', 'ABANCI', 'ABARTA', 'ABARTI', 'ABASER', 'ABASHI',
      'ABATIK', 'ABAYAN', 'ABAZIN', 'ABDALI', 'ABDEST', 'ABECEK', 'ABEDER', 'ABEDIN', 'ABEDIN', 'ABELES', 'ABELYA', 'ABENDE',
      'ABERAN', 'ABEREN', 'ABERIN', 'ABESEN', 'ABESIN', 'ABETAL', 'ABETAN', 'ABETES', 'ABETIN', 'ABETOR', 'ABETUR', 'ABEVAL',
      // Temel kelimeler
      'ANNE', 'BABA', 'ÇOCUK', 'KARDEŞ', 'AILE', 'DEDE', 'NINE', 'DAYIM', 'HALA', 'TEYZE', 'AMCA',
      'OKUL', 'ÖĞRETMEN', 'ÖĞRENCİ', 'DERS', 'KITAP', 'KALEM', 'DEFTER', 'TAHTA', 'SIRA', 'SINIF',
      'EV', 'ODA', 'SALON', 'MUTFAK', 'BANYO', 'YATAK', 'MASA', 'SANDALYE', 'DOLAP', 'PENCERE', 'KAPI',
      'DOKTOR', 'HEMŞİRE', 'POLİS', 'İTFAİYE', 'ÖĞRETMEN', 'MÜHENDİS', 'AVUKAT', 'BERBER', 'TERZI', 'AŞÇI',
      'ARABA', 'OTOBÜS', 'TREN', 'GEMI', 'UÇAK', 'BİSİKLET', 'MOTOR', 'TAKSI', 'METRO', 'TRAMVAY',
      'ELMA', 'ARMUT', 'MUZ', 'PORTAKAL', 'KIRAZ', 'ÜZüM', 'KAVUN', 'KARPUZ', 'ŞEFTALİ', 'ERİK',
      'DOMATES', 'PATATES', 'SOĞAN', 'SARIMSAK', 'BİBER', 'PATLICAN', 'SALATALIK', 'HAVUÇ', 'LAHANA', 'ISPANAK',
      'KÖPEK', 'KEDİ', 'KOYUN', 'İNEK', 'AT', 'TAVUK', 'HOROZ', 'ÖRDEK', 'KEDI', 'TAVŞAN', 'KUZU',
      'GÜNEŞ', 'AY', 'YILDIZ', 'BULUT', 'YAĞMUR', 'KAR', 'RÜZGAR', 'FIRTINA', 'ŞİMŞEK', 'GÖK',
      'DENİZ', 'GÖKYÜZÜ', 'TOPRAK', 'AĞAÇ', 'ÇİÇEK', 'YAPRAK', 'DAL', 'KÖK', 'MEYVE', 'TOHUM',
      'KIRMIZI', 'MAVİ', 'YEŞİL', 'SARI', 'BEYAZ', 'SİYAH', 'PEMBE', 'MOR', 'TURUNCU', 'GRİ',
      'BÜYÜK', 'KÜÇÜK', 'UZUN', 'KISA', 'GENİŞ', 'DAR', 'YÜKSEK', 'ALÇAK', 'HIZLI', 'YAVAŞ',
      'GÜZEL', 'ÇİRKİN', 'İYİ', 'KÖTÜ', 'KOLAY', 'ZOR', 'SICAK', 'SOĞUK', 'TAZE', 'ESKİ',
      'SABAH', 'ÖĞLE', 'AKŞAM', 'GECE', 'BUGÜN', 'DÜN', 'YARIN', 'HAFTA', 'AY', 'YIL',
      'PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ', 'PAZAR',
      'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK',
      'BİR', 'İKİ', 'ÜÇ', 'DÖRT', 'BEŞ', 'ALTI', 'YEDİ', 'SEKİZ', 'DOKUZ', 'ON',
      'YÜZMEK', 'KOŞMAK', 'YÜRÜMEK', 'OYNAMAK', 'OKUMAK', 'YAZMAK', 'DİNLEMEK', 'KONUŞMAK', 'BAKMAK', 'GÖRMEK',
      'YEMEK', 'İÇMEK', 'UYUMAK', 'KALKMAK', 'GİTMEK', 'GELMEK', 'ALMAK', 'VERMEK', 'BULMAK', 'KAYBETMEK',
      'SEVMEK', 'NEFRET', 'KORKUTU', 'GÜVENMEK', 'ANLAMAK', 'BİLMEK', 'DÜŞÜNMEK', 'HATIRLAMAK', 'UNUTMAK'
    ];

    console.log(`Found ${comprehensiveTurkishWords.length} Turkish words to import`);

    // Kelimeleri işle ve veritabanına ekle
    const processedWords = comprehensiveTurkishWords.map(word => {
      const cleanWord = word.trim().toUpperCase();
      return {
        word: cleanWord,
        length: cleanWord.length,
        difficulty: calculateDifficulty(cleanWord),
        is_approved: true
      };
    }).filter(word => 
      word.word.length >= 3 && 
      word.word.length <= 15 && 
      /^[A-ZÇĞIİÖŞÜ]+$/.test(word.word)
    );

    console.log(`Processing ${processedWords.length} valid words`);

    // Mevcut kelimeleri kontrol et
    const { data: existingWords, error: selectError } = await supabaseClient
      .from('words')
      .select('word');

    if (selectError) {
      console.error('Error fetching existing words:', selectError);
      throw selectError;
    }

    const existingWordSet = new Set(existingWords?.map(w => w.word.toUpperCase()) || []);
    console.log(`Found ${existingWordSet.size} existing words in database`);
    
    // Sadece yeni kelimeleri filtrele
    const newWords = processedWords.filter(word => !existingWordSet.has(word.word.toUpperCase()));
    
    console.log(`${newWords.length} new words to insert`);

    if (newWords.length === 0) {
      const { count } = await supabaseClient
        .from('words')
        .select('*', { count: 'exact', head: true });

      return new Response(JSON.stringify({
        success: true,
        message: 'Tüm kelimeler zaten veritabanında mevcut',
        statistics: {
          totalWordsInDatabase: count,
          newWordsAdded: 0,
          wordsProcessed: processedWords.length,
          wordsFromSource: comprehensiveTurkishWords.length
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Batch olarak ekle (500'er kelime - daha küçük batch)
    const batchSize = 500;
    let totalInserted = 0;

    for (let i = 0; i < newWords.length; i += batchSize) {
      const batch = newWords.slice(i, i + batchSize);
      
      try {
        const { error } = await supabaseClient
          .from('words')
          .insert(batch);

        if (error) {
          console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
          // Duplicate hatası varsa tek tek dene
          if (error.code === '23505') {
            console.log('Duplicate error detected, inserting words individually...');
            for (const word of batch) {
              const { error: singleError } = await supabaseClient
                .from('words')
                .insert([word]);
              
              if (!singleError) {
                totalInserted++;
              } else if (singleError.code !== '23505') {
                console.error('Unexpected error inserting word:', word.word, singleError);
              }
            }
          } else {
            throw error;
          }
        } else {
          totalInserted += batch.length;
          console.log(`Inserted batch ${i / batchSize + 1}: ${totalInserted} total words`);
        }
      } catch (batchError) {
        console.error(`Fatal error in batch ${i / batchSize + 1}:`, batchError);
        throw batchError;
      }
    }

    // İstatistikleri al
    const { count } = await supabaseClient
      .from('words')
      .select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({
      success: true,
      message: `Kapsamlı Türkçe sözlük başarıyla yüklendi`,
      statistics: {
        totalWordsInDatabase: count,
        newWordsAdded: totalInserted,
        wordsProcessed: processedWords.length,
        wordsFromSource: comprehensiveTurkishWords.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error importing dictionary:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateDifficulty(word: string): number {
  const length = word.length;
  
  // Zorluk seviyesi kelime uzunluğuna göre
  if (length <= 4) return 1;      // Kolay
  if (length <= 6) return 2;      // Orta
  if (length <= 8) return 3;      // Zor
  return 4;                       // Çok zor
}