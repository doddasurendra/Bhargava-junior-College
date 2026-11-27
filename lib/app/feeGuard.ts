/**
 * College rule: students see no fee information. AI and search features answer a student's question about
 * their own fees, dues, payments or receipts with a polite redirect. Public fee-structure questions
 * ("what is the fee for the JEE program?") are not personal and are answered from published content.
 */
const FEE = /\bfees?\b|\bdues?\b|\bbalance\b|instal|\breceipts?\b|\bpayments?\b|\bpaid\b|\bpay\b|outstanding|pending amount|ఫీజు|బాకీ|రసీదు|చెల్లింపు|చెల్లించ|फ़ीस|फीस|शुल्क|बकाया|किस्त|रसीद|भुगतान/i;
const PERSONAL = /\b(my|mine|me|i|our)\b|\bdue\b|\bpaid\b|\bpending\b|\bbalance\b|\boutstanding\b|\bleft to pay\b|\breceipt|\bhow much .*(owe|left|remaining)|నా |నాకు|నాది|బాకీ|ఎంత.*(కట్టాలి|చెల్లించాలి|ఉంది)|मेरा|मेरी|मेरे|बकाया|कितनी.*(बाकी|देनी)|कितना.*(बाकी|देना)/i;

export const isPersonalFeeQuestion = (q: string) => FEE.test(q) && PERSONAL.test(q);

export const FEES_PARENT_ONLY_TEXT = {
  en: 'Fee details are shared with your parent or guardian. Please ask them or contact the accounts office.',
  te: 'ఫీజు వివరాలు మీ తల్లిదండ్రులు లేదా సంరక్షకులతో పంచుకోబడతాయి. దయచేసి వారిని అడగండి లేదా అకౌంట్స్ కార్యాలయాన్ని సంప్రదించండి.',
  hi: 'फ़ीस की जानकारी आपके माता-पिता या अभिभावक के साथ साझा की जाती है। कृपया उनसे पूछें या लेखा कार्यालय से संपर्क करें।',
} as const;
export const feesParentOnly = (lang: string) => FEES_PARENT_ONLY_TEXT[(lang === 'te' || lang === 'hi' ? lang : 'en') as 'en'];
