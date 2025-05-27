import { Language } from '../types';

export const numberToWords = (num: number, lang: Language): string => {
  const ones = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const tens = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const thousands = ['', 'mil', 'millón', 'mil millones', 'billón'];
  const thousandsPlural = ['', 'mil', 'millones', 'mil millones', 'billones'];

  const onesEn = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const tensEn = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const teensEn = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const hundredsEn = ['', 'one hundred', 'two hundred', 'three hundred', 'four hundred', 'five hundred', 'six hundred', 'seven hundred', 'eight hundred', 'nine hundred'];
  const thousandsEn = ['', 'thousand', 'million', 'billion', 'trillion'];

  const getWords = (n: number, lang: Language): string => {
    if (n === 0) return '';
    if (n < 10) return lang === 'es' ? ones[n] : onesEn[n];
    if (n < 20) return lang === 'es' ? teens[n - 10] : teensEn[n - 10];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const one = n % 10;
      if (lang === 'es') {
        return tens[ten] + (one ? ' y ' + ones[one] : '');
      } else {
        return tensEn[ten] + (one ? '-' + onesEn[one] : '');
      }
    }
    if (n < 1000) {
      const hundred = Math.floor(n / 100);
      const rest = n % 100;
      if (lang === 'es') {
        return (n === 100 ? 'cien' : hundreds[hundred]) + (rest ? ' ' + getWords(rest, lang) : '');
      } else {
        return hundredsEn[hundred] + (rest ? ' ' + getWords(rest, lang) : '');
      }
    }
    let words = '';
    let i = 0;
    while (n > 0) {
      if (n % 1000 !== 0) {
        const chunk = n % 1000;
        if (lang === 'es') {
          const suffix = i > 0 ? (chunk > 1 ? thousandsPlural[i] : thousands[i]) : '';
          words = getWords(chunk, lang) + ' ' + suffix + ' ' + words;
        } else {
          words = getWords(chunk, lang) + ' ' + thousandsEn[i] + (chunk > 1 && i > 0 ? 's' : '') + ' ' + words;
        }
      }
      n = Math.floor(n / 1000);
      i++;
    }
    return words.trim();
  };

  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);

  let result = getWords(dollars, lang);
  if (cents > 0) {
    result += lang === 'es' ? ' con ' : ' and ';
    result += getWords(cents, lang);
    result += lang === 'es' ? ' centavos' : ' cents';
  }

  return result.charAt(0).toUpperCase() + result.slice(1);
};