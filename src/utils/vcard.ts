/**
 * Minimal vCard (.vcf) parser for importing contacts exported from Google
 * Contacts ("Export -> vCard") or any phone. Handles vCard 2.1/3.0/4.0
 * basics: FN / N, TEL, EMAIL, folded continuation lines, and
 * QUOTED-PRINTABLE encoded names (common in Android 2.1 exports).
 */

export interface ParsedVCard {
  name: string;
  phone?: string;
  email?: string;
}

function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else if (lines.length && /=$/.test(lines[lines.length - 1]) && /QUOTED-PRINTABLE/i.test(lines[lines.length - 1])) {
      // quoted-printable soft line break
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + line;
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function decodeQuotedPrintable(s: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(s.charCodeAt(i));
    }
  }
  try {
    return decodeURIComponent(bytes.map((b) => '%' + b.toString(16).padStart(2, '0')).join(''));
  } catch {
    return String.fromCharCode(...bytes);
  }
}

function unescapeValue(v: string): string {
  return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

export function parseVCards(text: string): ParsedVCard[] {
  const out: ParsedVCard[] = [];
  let cur: { fn?: string; n?: string; tel?: string; email?: string; telPref?: boolean } | null = null;

  for (const line of unfold(text)) {
    const upper = line.toUpperCase();
    if (upper.startsWith('BEGIN:VCARD')) {
      cur = {};
      continue;
    }
    if (upper.startsWith('END:VCARD')) {
      if (cur) {
        const name = (cur.fn || cur.n || '').trim();
        if (name || cur.tel || cur.email) {
          out.push({ name: name || cur.email || cur.tel || 'Unnamed', phone: cur.tel, email: cur.email });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    let value = line.slice(colon + 1);
    const [propRaw, ...params] = head.split(';');
    const prop = propRaw.replace(/^item\d+\./i, '').toUpperCase();
    const paramStr = params.join(';').toUpperCase();
    if (paramStr.includes('QUOTED-PRINTABLE')) value = decodeQuotedPrintable(value);

    if (prop === 'FN') cur.fn = unescapeValue(value);
    else if (prop === 'N' && !cur.fn) {
      const [family, given, middle] = value.split(';').map(unescapeValue);
      cur.n = [given, middle, family].filter(Boolean).join(' ');
    } else if (prop === 'TEL') {
      const tel = value.replace(/^tel:/i, '').trim();
      const pref = /PREF/.test(paramStr);
      if (tel && (!cur.tel || (pref && !cur.telPref))) {
        cur.tel = tel;
        cur.telPref = pref;
      }
    } else if (prop === 'EMAIL' && !cur.email) {
      cur.email = value.trim();
    }
  }
  return out;
}

/** Normalised key used to avoid importing the same person twice. */
export function contactDedupeKey(c: { name: string; phone?: string; email?: string }): string {
  if (c.email) return 'e:' + c.email.trim().toLowerCase();
  if (c.phone) return 'p:' + c.phone.replace(/\D/g, '').slice(-10);
  return 'n:' + c.name.trim().toLowerCase();
}
