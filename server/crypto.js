// Dependency-free Ethereum personal_sign verifier.
// Implements Keccak-256 and secp256k1 public key recovery, not SHA3-256.
const MASK = (1n << 64n) - 1n;
const ROT = [
  [0,36,3,41,18], [1,44,10,45,2], [62,6,43,15,61],
  [28,55,25,21,56], [27,20,39,8,14],
];
const RC = [
  '0000000000000001','0000000000008082','800000000000808a','8000000080008000',
  '000000000000808b','0000000080000001','8000000080008081','8000000000008009',
  '000000000000008a','0000000000000088','0000000080008009','000000008000000a',
  '000000008000808b','800000000000008b','8000000000008089','8000000000008003',
  '8000000000008002','8000000000000080','000000000000800a','800000008000000a',
  '8000000080008081','8000000000008080','0000000080000001','8000000080008008',
].map(h => BigInt('0x' + h));
function rotate(x,n) { const m=BigInt(n); return m === 0n ? x : ((x << m) | (x >> (64n-m))) & MASK; }
function permutation(a) {
  for (const rc of RC) {
    const c = Array.from({length:5},(_,x)=> a[x]^a[x+5]^a[x+10]^a[x+15]^a[x+20]);
    for(let x=0;x<5;x++) { const d = c[(x+4)%5] ^ rotate(c[(x+1)%5],1); for(let y=0;y<5;y++) a[x+5*y] ^= d; }
    const b = new Array(25).fill(0n);
    for(let x=0;x<5;x++) for(let y=0;y<5;y++) b[y+5*((2*x+3*y)%5)] = rotate(a[x+5*y], ROT[x][y]);
    for(let x=0;x<5;x++) for(let y=0;y<5;y++) a[x+5*y] = b[x+5*y] ^ ((MASK ^ b[(x+1)%5+5*y]) & b[(x+2)%5+5*y]);
    a[0] ^= rc;
  }
}
export function keccak256(input) {
  const src = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
  const rate=136;
  const padded = new Uint8Array(Math.ceil((src.length+1)/rate)*rate || rate);
  padded.set(src); padded[src.length] ^= 0x01; padded[padded.length-1] ^= 0x80;
  const a = new Array(25).fill(0n);
  for(let i=0;i<padded.length;i+=rate) {
    for(let k=0;k<rate;k++) a[Math.floor(k/8)] ^= BigInt(padded[i+k]) << BigInt((k%8)*8);
    permutation(a);
  }
  const out = new Uint8Array(32);
  for(let i=0;i<32;i++) out[i]=Number((a[Math.floor(i/8)] >> BigInt((i%8)*8)) & 0xffn);
  return out;
}
const P=0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const G={x:0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,y:0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n};
const mod=(a,p)=>((a%p)+p)%p;
function pow(x,n,p) { let y=1n; x=mod(x,p); while(n>0n){if(n&1n)y=mod(y*x,p);x=mod(x*x,p);n>>=1n;}return y; }
function inverse(x,p) { if(mod(x,p)===0n) throw new Error('Invalid inverse'); return pow(x,p-2n,p); }
function add(a,b) {
  if(!a)return b;
  if(!b)return a;
  if(a.x===b.x && mod(a.y+b.y,P)===0n) return null;
  let lambda;
  if(a.x===b.x && a.y===b.y) lambda=mod((3n*a.x*a.x)*inverse(2n*a.y,P),P);
  else lambda=mod((b.y-a.y)*inverse(b.x-a.x,P),P);
  const x=mod(lambda*lambda-a.x-b.x,P);
  return {x,y:mod(lambda*(a.x-x)-a.y,P)};
}
function multiply(point,k) {
  let acc=null; let cur=point; k=mod(k,N);
  while(k>0n){if(k&1n)acc=add(acc,cur);cur=add(cur,cur);k>>=1n;}
  return acc;
}
function bytesToBigInt(v) {return BigInt('0x'+Buffer.from(v).toString('hex'));}
function bigintBytes(n,size=32) {return Buffer.from(n.toString(16).padStart(size*2,'0'),'hex');}
export function recoverFromDigest(digest,signature) {
  if(typeof signature!=='string'||!/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Error('Invalid signature format');
  const bytes=Buffer.from(signature.slice(2),'hex');
  const r=bytesToBigInt(bytes.subarray(0,32));const s=bytesToBigInt(bytes.subarray(32,64));
  let recovery=bytes[64];if(recovery>=27)recovery-=27;
  if(recovery!==0&&recovery!==1)throw new Error('Unsupported recovery id');
  if(r<=0n||r>=N||s<=0n||s>=N || s > N/2n)throw new Error('Invalid signature scalars');
  const x=r;
  if(x>=P)throw new Error('Invalid R x coordinate');
  let y=pow(mod(x*x*x+7n,P),(P+1n)/4n,P);
  if(mod(y*y-x*x*x-7n,P)!==0n)throw new Error('Invalid R point');
  if(Number(y&1n)!==recovery)y=P-y;
  const R={x,y};
  const z=bytesToBigInt(digest);
  const Q=add(multiply(R,mod(s*inverse(r,N),N)),multiply(G,mod(-z*inverse(r,N),N)));
  if(!Q)throw new Error('Invalid public key');
  const uncompressed=Buffer.concat([bigintBytes(Q.x),bigintBytes(Q.y)]);
  return '0x'+Buffer.from(keccak256(uncompressed)).subarray(12).toString('hex');
}
export function recoverPersonalSign(message,signature) {
  const payload=new TextEncoder().encode(message);
  const prefix=new TextEncoder().encode(`\x19Ethereum Signed Message:\n${payload.length}`);
  const toHash=new Uint8Array(prefix.length+payload.length);
  toHash.set(prefix);toHash.set(payload,prefix.length);
  return recoverFromDigest(keccak256(toHash),signature);
}
export function isAddress(s) {return typeof s==='string'&&/^0x[a-f0-9]{40}$/i.test(s);}
