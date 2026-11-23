// BIP-173 Bech32 validator matching Gno address.IsValid() for g1... addresses.

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const b = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >>> i) & 1) {
        chk ^= GEN[i];
      }
    }
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i++) {
    out.push(hrp.charCodeAt(i) >>> 5);
  }
  out.push(0);
  for (let i = 0; i < hrp.length; i++) {
    out.push(hrp.charCodeAt(i) & 31);
  }
  return out;
}

export function isValidGnoAddress(addr: string): boolean {
  if (!addr || addr.length !== 40) return false;
  if (addr !== addr.toLowerCase() && addr !== addr.toUpperCase()) return false;
  const lower = addr.toLowerCase();
  if (!lower.startsWith('g1')) return false;

  const sep = lower.lastIndexOf('1');
  if (sep < 1 || sep + 7 > lower.length) return false;

  const hrp = lower.slice(0, sep);
  const data: number[] = [];
  for (let i = sep + 1; i < lower.length; i++) {
    const idx = CHARSET.indexOf(lower[i]);
    if (idx === -1) return false;
    data.push(idx);
  }

  return polymod([...hrpExpand(hrp), ...data]) === 1;
}
