import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Turkish word list embedded in the function
const TURKISH_WORDS = [
  'AB', 'ABA', 'ABACI', 'ABACILICK', 'ABADI', 'ABAJUR', 'ABAJURCU', 'ABAJURCULUK', 'ABAJURLU', 'ABAJURSUZ',
  'ABAKÜS', 'ABALI', 'ABANA', 'ABANDIRMA', 'ABANDIRMAK', 'ABANDONE', 'ABANIK', 'ABANI', 'ABANMA', 'ABANMAK',
  'ABANOZ', 'ABANOZGILLER', 'ABANOZLAŞMA', 'ABANOZLAŞMAK', 'ABARTI', 'ABARTICI', 'ABARTICILIK', 'ABARTILI',
  'ABARTILMA', 'ABARTILMAK', 'ABARTISIZ', 'ABARTISIZLIK', 'ABARTIŞ', 'ABARTMA', 'ABARTMACI', 'ABARTMACILIK',
  'ABARTMAK', 'ABARTMALI', 'ABARTMASIZ', 'ABASIZ', 'ABAŞO', 'ABAT', 'ABAZA', 'ABAZACA', 'ABAZAN', 'ABAZANLIK',
  'ABBAS', 'ABD', 'ABDAL', 'ABDALLIK', 'ABDEST', 'ABDESTBOZAN', 'ABDESTHANE', 'ABDESTLI', 'ABDESTLIK',
  'ABDESTLILIK', 'ABDESTSIZ', 'ABDESTSIZLIK', 'ABECE', 'ABECESEL', 'ABERASYON', 'ABES', 'ABESLIK', 'ABIHAYAT',
  'ABIKEVSER', 'ABIDE', 'ABIDELEŞME', 'ABIDELEŞMEK', 'ABIDELEŞTIRME', 'ABIDELEŞTIRMEK', 'ABIDEVI', 'ABIS',
  'ABIYE', 'ABLA', 'ABLACI', 'ABLACILIK', 'ABLAK', 'ABLAKÇA', 'ABLAKLICK', 'ABLALIK', 'ABLATIF', 'ABLATYA',
  'ABLI', 'ABLUKA', 'ABONE', 'ABONELIK', 'ABONMAN', 'ABORDA', 'ABORJIN', 'ABRA', 'ABRAKADABRA', 'ABRAMA',
  'ABRAMAK', 'ABRAŞ', 'ABRIL', 'ABSORBE', 'ABSTRAKSIYONIZM', 'ABSTRE', 'ABSÜRT', 'ABU', 'ABUHAVA', 'ACABA',
  'ACAR', 'ACARA', 'ACARLAŞMA', 'ACARLAŞMAK', 'ACARLIK', 'ACAYIP', 'ACAYIPLEŞME', 'ACAYIPLEŞMEK',
  'ACAYIPLEŞTIRME', 'ACAYIPLEŞTIRMEK', 'ACAYIPLIK', 'ACE', 'ACELE', 'ACELECI', 'ACELECILIK', 'ACELELEŞTIRME',
  'ACELELEŞTIRMEK', 'ACEM', 'ACEMAŞIRAN', 'ACEMBORUSU', 'ACEMBUSELIK', 'ACEMCE', 'ACEMI', 'ACEMICE',
  'ACEMILEŞME', 'ACEMILEŞMEK', 'ACEMILIK', 'ACEMKÜRDI', 'ACENTE', 'ACENTELIK', 'ACEP', 'ACEZE', 'ACI',
  'ACICA', 'ACIGÖL', 'ACIKILLI', 'ACIKLILLICK', 'ACIKMA', 'ACIKMAK', 'ACIKTIRMA', 'ACIKTIRMAK', 'ACILANMA',
  'ACILANMAK', 'ACILAŞMA', 'ACILAŞMAK', 'ACILAŞTIRMA', 'ACILAŞTIRMAK', 'ACILI', 'ACILIK', 'ACILILICK',
  'ACIMA', 'ACIMAK', 'ACIMASIZ', 'ACIMASIZCA', 'ACIMIK', 'ACIMSI', 'ACIMTIRAK', 'ACINDIRMA', 'ACINDIRMAK',
  'ACINILMA', 'ACINILMAK', 'ACINMA', 'ACINMAK', 'ACIPAYAM', 'ACIRAK', 'ACIRGA', 'ACISIZ', 'ACISIZLIK',
  'ACITIŞ', 'ACITMA', 'ACITMAK', 'ACIYICI', 'ACIYIŞ', 'ACIBE', 'ACIL', 'ACILEN', 'ACIZ', 'ACIZANE',
  'ACUBE', 'ACUL', 'ACUN', 'ACUR', 'ACUZE', 'ACYO', 'AÇ', 'AÇACAK', 'AÇAN', 'AÇAR', 'AÇELYA', 'AÇGÖZ',
  'AÇGÖZLÜ', 'AÇGÖZLÜLÜK', 'AÇI', 'AÇICI', 'AÇICILIK', 'AÇIK', 'AÇIKÇA', 'AÇIKÇASI', 'AÇIKÇI', 'AÇIKGÖZ',
  'AÇIKGÖZLÜK', 'AÇIKGÖZLÜLÜK', 'AÇIKLAMA', 'AÇIKLAMAK', 'AÇIKLAMALI', 'AÇIKLANAN', 'AÇIKLANMA', 'AÇIKLANMAK',
  'AÇIKLAŞMA', 'AÇIKLAŞMAK', 'AÇIKLAŞTIRMA', 'AÇIKLAŞTIRMAK', 'AÇIKLATMA', 'AÇIKLATMAK', 'AÇIKLAYAN',
  'AÇIKLAYICI', 'AÇIKLAYICILIK', 'AÇIKLAYIŞ', 'AÇIKLIK', 'AÇIKTAN', 'AÇILAMA', 'AÇILIM', 'AÇILIŞ', 'AÇILMA',
  'AÇILMAK', 'AÇIM', 'AÇIMLAMA', 'AÇIMLAMAK', 'AÇIMLANMA', 'AÇIMLANMAK', 'AÇINDIRMA', 'AÇINDIRMAK', 'AÇINIM',
  'AÇINMA', 'AÇINMAK', 'AÇINSAMA', 'AÇINSAMAK', 'AÇIORTAY', 'AÇIÖLÇER', 'AÇISAL', 'AÇIŞ', 'AÇIT', 'AÇKI',
  'AÇKICI', 'AÇKILAMA', 'AÇKILAMAK', 'AÇKILANMA', 'AÇKILANMAK', 'AÇKILATMA', 'AÇKILATMAK', 'AÇKILI', 'AÇKISIZ',
  'AÇLIK', 'AÇMA', 'AÇMACI', 'AÇMACILIK', 'AÇMAK', 'AÇMALIK', 'AÇMAZ', 'AÇMAZLIK', 'AÇTIRMA', 'AÇTIRMAK',
  'AÇVAL', 'AD', 'ADA', 'ADACIK', 'ADACYO', 'ADAK', 'ADAKLAMA', 'ADAKLAMAK', 'ADAKLANMA', 'ADAKLANMAK',
  'ADAKLI', 'ADAKLIK', 'ADAKSIZ', 'ADALAR', 'ADALE', 'ADALELI', 'ADALESIZ', 'ADALET', 'ADALETLI', 'ADALETLILIK',
  'ADALETSIZ', 'ADALETSIZLIK', 'ADALI', 'ADAM', 'ADLI', 'ADLIK', 'ANNE', 'ARABA', 'BABA', 'BAL', 'BALCI',
  'BALCILIK', 'BALIK', 'BALIKSIZ', 'BANK', 'BANKA', 'BANKACILIK', 'BAŞ', 'BAŞKA', 'BİR', 'BİRER', 'BİRLİK',
  'BU', 'BUGÜN', 'BURA', 'BURASI', 'BÜRO', 'BÜYÜK', 'BÜYÜKLÜK', 'CAM', 'CAMCI', 'CAMCILIK', 'CAMI', 'CAMLI',
  'CAMSIZ', 'CEP', 'CEPLI', 'CEPSIZ', 'DAL', 'DALI', 'DALIŞ', 'DAR', 'DARLIK', 'DE', 'DEĞİL', 'DEN', 'DİL',
  'DOKTOR', 'DUR', 'DURAK', 'DURAKLAMA', 'DURAKLAMAK', 'DURAKLATMA', 'DURAKLATMAK', 'DURMA', 'DURMAK',
  'EL', 'ELLİ', 'ELLİLİK', 'ELMA', 'ELMALI', 'ELMASIZ', 'EV', 'EVLİ', 'EYE', 'EYLEM', 'FAL', 'FALCI',
  'FALCILIK', 'FALI', 'FİL', 'FİLLİ', 'GAL', 'GALA', 'GEL', 'GELME', 'GELMEK', 'GİR', 'GİRME', 'GİRMEK',
  'GÖRMEK', 'GÖZ', 'GÖZLÜ', 'GÖZLÜK', 'HEP', 'HİÇ', 'İKİ', 'İL', 'İLK', 'İN', 'İNE', 'İNME', 'İNMEK',
  'KAL', 'KALMA', 'KALMAK', 'KAP', 'KAPI', 'KAPICI', 'KAPICILIK', 'KAPILI', 'KAPISIZ', 'KAR', 'KARLI',
  'KARSIZ', 'KEDİ', 'KEDİLİ', 'KELIME', 'KÖPEK', 'KÖPEKLI', 'KÖR', 'KÖRLÜK', 'MAL', 'MALI', 'NE', 'NEDİR',
  'OKUL', 'OYUN', 'PARK', 'PARKI', 'PARKSIZ', 'PUAN', 'SAAT', 'SAATLI', 'SAATSIZ', 'SAL', 'SALA', 'SALMA',
  'SALMAK', 'SES', 'SESLİ', 'SESSIZ', 'SKOR', 'SON', 'SONRA', 'SU', 'SULU', 'SUSUZ', 'ŞU', 'ŞURA', 'ŞURASI',
  'TAM', 'TAMAM', 'TAMAMEN', 'TEK', 'TEKRAR', 'TEN', 'TOP', 'TOPLA', 'TOPLAMA', 'TOPLAMAK', 'TOPLU', 'TOPSUZ',
  'TÜRKÇE', 'UÇ', 'UÇAK', 'UÇAKLI', 'UÇAKSIZ', 'UÇMA', 'UÇMAK', 'VAR', 'VARMAK', 'VARMA', 'VE', 'YA', 'YAP',
  'YAPMA', 'YAPMAK', 'YEP', 'YEŞİL', 'YEŞİLLİK', 'YOK', 'YOL', 'YOLLA', 'YOLLAMA', 'YOLLAMAK', 'YOLLU',
  'YOLSUZ', 'ZOR', 'ZORLUK'
];

// Cache for wordlist to avoid repeated processing
let wordlistCache: Set<string> | null = null;

async function loadWordlist(): Promise<Set<string>> {
  if (wordlistCache) {
    return wordlistCache;
  }

  wordlistCache = new Set(TURKISH_WORDS);
  console.log(`Loaded ${wordlistCache.size} words from embedded wordlist`);
  return wordlistCache;
}

function calculatePoints(word: string): number {
  // Temel puan hesaplama
  let points = word.length * 10;
  
  // Nadir harfler için bonus
  const rareLetters = ['Ç', 'Ğ', 'J', 'Ö', 'Ş', 'Ü', 'Q', 'W', 'X', 'Z'];
  for (const letter of word) {
    if (rareLetters.includes(letter)) {
      points += 5;
    }
  }
  
  // Uzun kelimeler için bonus
  if (word.length >= 6) points += 20;
  if (word.length >= 8) points += 40;
  
  return points;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { word } = await req.json();
    
    if (!word || typeof word !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: 'Word is required and must be a string' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const upperWord = word.trim().toUpperCase();
    console.log(`Validating word: ${upperWord}`);

    // Load wordlist
    const wordlist = await loadWordlist();
    
    // Check if word exists in our wordlist
    const isValid = wordlist.has(upperWord);
    
    let result;
    if (isValid) {
      const points = calculatePoints(upperWord);
      result = {
        isValid: true,
        points,
        message: `"${upperWord}" geçerli bir kelime! (${points} puan)`
      };
    } else {
      result = {
        isValid: false,
        points: 0,
        message: `"${upperWord}" kelime listesinde bulunamadı.`
      };
    }

    console.log(`Word validation result: ${upperWord} -> ${isValid ? 'valid' : 'invalid'}`);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in word validation:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        isValid: false,
        points: 0,
        message: 'Kelime doğrulama sırasında hata oluştu'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});