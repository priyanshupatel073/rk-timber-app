// Indian Numbering System to Words Converter
export function numberToWordsIndian(num) {
  if (num === null || num === undefined || isNaN(num) || num === 0) {
    return 'ZERO RUPEES ONLY';
  }

  const a = [
    '', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ',
    'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '
  ];
  const b = ['', '', 'TWENTY ', 'THIRTY ', 'FORTY ', 'FIFTY ', 'SIXTY ', 'SEVENTY ', 'EIGHTY ', 'NINETY '];

  const inWords = (n) => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + 'HUNDRED ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  };

  let n = Math.floor(Math.abs(num));
  const decimal = Math.round((Math.abs(num) - n) * 100);

  if (n === 0 && decimal === 0) return 'ZERO RUPEES ONLY';

  let crore = Math.floor(n / 10000000);
  n %= 10000000;
  let lakh = Math.floor(n / 100000);
  n %= 100000;
  let thousand = Math.floor(n / 1000);
  n %= 1000;
  let remaining = n;

  let res = '';
  if (crore > 0) res += inWords(crore) + 'CRORE ';
  if (lakh > 0) res += inWords(lakh) + 'LAKH ';
  if (thousand > 0) res += inWords(thousand) + 'THOUSAND ';
  if (remaining > 0) res += inWords(remaining);

  res = res.trim();
  if (res) res += ' RUPEES';

  if (decimal > 0) {
    if (res) res += ' AND ';
    res += inWords(decimal).trim() + ' PAISE';
  }

  return (res + ' ONLY').toUpperCase();
}

export default numberToWordsIndian;
