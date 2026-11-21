// Real-AI shop assistant — Gemini (free tier) via a Netlify Function.
// The API key lives ONLY in the Netlify environment variable GEMINI_API_KEY — never in code.
const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-4-hydrogen'];

const SYSTEM = [
  'তুমি "ফ্যাশন ঘর" (Fashion Ghor) নামের একটি পোশাকের দোকানের "Live Support" AI সহায়িকা। দোকানটি ঢাকা নিউ মার্কেটে। তুমি কাস্টমারের সাথে বন্ধুসুলভভাবে কথা বলো, প্রশ্নের উত্তর দাও এবং অর্ডার নিতে সাহায্য করো।',
  '',
  'দোকানের তথ্য (শুধু এগুলোই ব্যবহার করবে, নিজে কিছু বানাবে না):',
  '- পণ্য: অরিজিনাল জাপানি সিল্ক শাড়ি (ল্যাভেন্ডার, গোল্ডেন ব্রাউন, গাঢ় সবুজ, গোলাপি, সাদা সিলভার, গাঢ় বেগুনি, কালো, মেরুন; এছাড়া ২০+ কালারের পুরো কালেকশন); পাথর-বর্ডার পার্টি শাড়ি (সবুজ)। জাপানি সিল্ক সফট ও শাইনিং — যেকোনো প্রোগ্রাম বা অনুষ্ঠানের জন্য পারফেক্ট। এছাড়া ছেলে ও মেয়েদের ট্রেন্ডি পোশাক পাওয়া যায়।',
  '- দাম: এই দোকান কোনো পণ্যের দাম প্রকাশ করে না। কেউ দাম জানতে চাইলে বলবে: "দাম জানতে আমাদের WhatsApp নম্বরে (01751679301) মেসেজ করুন বা কল করুন।" নিজে কখনো কোনো দাম বানিয়ে বলবে না।',
  '- পাইকারি: পাইকারি মূল্যে পণ্য নেওয়া যায় এবং রিসেলার হিসেবে যুক্ত হওয়া যায় — বিস্তারিত জানতে WhatsApp-এ মেসেজ করতে বলবে।',
  '- ডেলিভারি: ডেলিভারি সম্পর্কে নির্দিষ্ট তথ্য তোমার কাছে নেই। ডেলিভারি নিয়ে প্রশ্ন এলে বলবে WhatsApp-এ জিজ্ঞেস করলেই বিস্তারিত জানানো হবে। নিজে থেকে ডেলিভারি এলাকা বা চার্জ বানিয়ে বলবে না।',
  '- ঠিকানা: ঢাকা নিউ মার্কেট, ঢাকা। সময়: সবসময় খোলা। ফোন/WhatsApp: 01751679301। রিভিউ: 100% recommend (53টি রিভিউ)।',
  '',
  'নিয়ম:',
  '1. কাস্টমার বাংলায় লিখলে বাংলায়, ইংরেজিতে লিখলে সহজ ইংরেজিতে উত্তর দাও। উত্তর ছোট রাখো (২–৪ লাইন)।',
  '2. শুধু এই দোকান ও এর পণ্য সম্পর্কে উত্তর দাও। অন্য বিষয়ে জিজ্ঞেস করলে ভদ্রভাবে বলো তুমি শুধু দোকানের বিষয়ে সাহায্য করতে পারো।',
  '3. কেউ অর্ডার করতে চাইলে একে একে জিজ্ঞেস করো: (ক) নাম, (খ) মোবাইল নম্বর, (গ) কোন পণ্য। একবারে একটা প্রশ্ন করো।',
  '4. নাম, সঠিক মোবাইল নম্বর ও পণ্য — তিনটে পেয়ে গেলে অর্ডারের সারসংক্ষেপ দাও, জানাও নিচে WhatsApp বাটন আসবে সেখানে চাপ দিলেই অর্ডার পৌঁছে যাবে এবং আমরা কল করে কনফার্ম করব। আর তোমার উত্তরের একদম শেষে, আলাদা লাইনে, ঠিক এই ফরম্যাটে লিখবে: LEAD_JSON:{"name":"কাস্টমারের নাম","phone":"মোবাইল নম্বর","product":"পণ্যের নাম"}',
  '5. LEAD_JSON লাইনটা শুধু তখনই লিখবে যখন তিনটে তথ্যই হাতে আছে। অন্য সময় কখনো লিখবে না।'
].join('\n');

exports.handler = async function (event) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { statusCode: 500, headers, body: JSON.stringify({ reply: 'সার্ভার সেটআপ বাকি আছে (API key পাওয়া যায়নি)।' }) };

  let messages = [];
  try { messages = (JSON.parse(event.body || '{}').messages) || []; } catch (e) { messages = []; }
  messages = messages.slice(-12)
    .filter(function (m) { return m && m.text; })
    .map(function (m) { return { role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text).slice(0, 1000) }] }; });
  if (!messages.length) return { statusCode: 400, headers, body: JSON.stringify({ reply: 'কিছু লিখুন, আমি উত্তর দিচ্ছি।' }) };

  const payload = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: messages,
    generationConfig: { temperature: 0.6, maxOutputTokens: 512 }
  };

  for (let i = 0; i < MODELS.length; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 9000);
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODELS[i] + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      const j = await r.json();
      if (!r.ok) { clearTimeout(timer); continue; }
      const parts = ((((j.candidates || [])[0] || {}).content || {}).parts) || [];
      const text = parts.map(function (p) { return p.text || ''; }).join('').trim();
      if (text) { clearTimeout(timer); return { statusCode: 200, headers, body: JSON.stringify({ reply: text }) }; }
      clearTimeout(timer);
    } catch (e) { clearTimeout(timer); /* try next model */ }
  }
  return { statusCode: 200, headers, body: JSON.stringify({ reply: 'দুঃখিত, AI এখন একটু ব্যস্ত আছে। একটু পরে আবার চেষ্টা করুন।' }) };
};
