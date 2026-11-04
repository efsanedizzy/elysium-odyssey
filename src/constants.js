export const CHAIN = {
  chainId: 99801,
  hexId: '0x185d9',
  chainName: 'Kinetiq Elysium Testnet',
  rpcUrls: ['https://testnet-rpc.elysium.kinetiq.xyz'],
  nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
  blockExplorerUrls: ['https://testnet.elysium.kinetiq.xyz'],
};

export const EXPLORER_URL = 'https://testnet.elysium.kinetiq.xyz';
export const DOCS_URL = 'https://elysium.kinetiq.xyz/docs/building-on-elysium';
export const ECOSYSTEM_URL = 'https://testnet.elysium.kinetiq.xyz/ecosystem';

export const X_PROFILE_URL = 'https://x.com/elysiumodyssey';
export const STREAK_BONUS = 100;
export function dailyStatus(dates = [], now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const days = [...new Set(dates)].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today).sort();
  let run = 0, best = 0, previous;
  for (const day of days) {
    const n = Date.parse(day + 'T00:00:00Z');
    run = previous !== undefined && n - previous === 86400000 ? run + 1 : 1;
    best = Math.max(best, run); previous = n;
  }
  const checkedIn = days.includes(today);
  const yesterday = new Date(Date.parse(today + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  const current = days.at(-1) === today || days.at(-1) === yesterday ? run : 0;
  const next = checkedIn ? current : current + 1;
  return { current, best, checkedIn, reward: 45 + (next > 0 && next % 7 === 0 ? STREAK_BONUS : 0),
    cycle: checkedIn ? ((current - 1) % 7) + 1 : current % 7,
    nextReset: new Date(Date.parse(today + 'T00:00:00Z') + 86400000).toISOString() };
}

export const SOCIAL_PROFILES = [
  {
    id: 'follow-hexisnetwork', projectName: 'Hexis Network', handle: 'hexisnetwork',
    targetUrl: 'https://x.com/hexisnetwork', profileImage: '/public/social-hexisnetwork.jpg'
  },
  {
    id: 'follow-ely-lock', projectName: 'Ely Lock', handle: 'ely_lock',
    targetUrl: 'https://x.com/ely_lock', profileImage: '/public/social-ely_lock.jpg'
  },
  {
    "id": "follow-elysindex",
    "projectName": "ElysIndex",
    "handle": "ElysIndex",
    "targetUrl": "https://x.com/ElysIndex",
    "profileImage": "/public/social-elysindex.jpg"
  },
  {
    "id": "follow-agora",
    "projectName": "Agora",
    "handle": "agora_elysium",
    "targetUrl": "https://x.com/agora_elysium",
    "profileImage": "/public/social-agora_elysium.jpg"
  },
  {
    "id": "follow-stockium",
    "projectName": "Stockium",
    "handle": "Stockium",
    "targetUrl": "https://x.com/Stockium",
    "profileImage": "/public/social-stockium.jpg"
  },
  {
    "id": "follow-homer",
    "projectName": "Homer",
    "handle": "homer_fi",
    "targetUrl": "https://x.com/homer_fi",
    "profileImage": "/public/social-homer_fi.jpg"
  },
  {
    "id": "follow-elysiumpump",
    "projectName": "Elysium Pump",
    "handle": "ElysiumPump",
    "targetUrl": "https://x.com/ElysiumPump",
    "profileImage": "/public/social-elysiumpump.png"
  },
  {
    "id": "follow-kleos",
    "projectName": "Kleos",
    "handle": "TheKleos_",
    "targetUrl": "https://x.com/TheKleos_",
    "profileImage": "/public/social-thekleos_.jpg"
  },
  {
    "id": "follow-manteion",
    "projectName": "Manteion",
    "handle": "ManteionH",
    "targetUrl": "https://x.com/ManteionH",
    "profileImage": "/public/social-manteionh.jpg"
  },
  {
    "id": "follow-boxa",
    "projectName": "Boxa",
    "handle": "boxa_elysium",
    "targetUrl": "https://x.com/boxa_elysium",
    "profileImage": "/public/social-boxa_elysium.jpg"
  }
];

export const QUESTS = [
  {
    id: 'welcome', name: 'The First Spark', short: 'Connect your wallet to begin your Odyssey.',
    description: 'Your journey begins with a secure wallet signature. No gas fees and no token transfer are required.',
    xp: 120, category: 'Getting Started', kind: 'automatic', tag: 'BEGINNER', icon: 'sparkles', time: '1 MIN', color: 'purple',
    steps: ['Connect an EVM-compatible wallet', 'Sign the login message', 'Receive your first XP automatically'],
  },
  {
    id: 'quiz', name: 'Know Your Realm', short: 'Prove you know the basics of the Elysium network.',
    description: 'Answer three quick questions about Elysium. Correct answers unlock your reward.',
    xp: 160, category: 'Learn', kind: 'quiz', tag: 'KNOWLEDGE', icon: 'book-open', time: '2 MIN', color: 'blue',
    steps: ['Study the network details', 'Answer all three questions correctly', 'Claim your XP'],
  },
  {
    id: 'explore', name: 'Chart the Unknown', short: 'Discover the official Elysium block explorer.',
    description: 'Open the Elysium testnet explorer and learn to inspect blocks and transactions. This exploration quest is self-attested.',
    xp: 80, category: 'Explore', kind: 'self', tag: 'DISCOVERY', icon: 'compass', time: '2 MIN', color: 'orange',
    steps: ['Open the official testnet explorer', 'Find the latest block', 'Confirm that you have explored it'],
  },
  {
    id: 'daily', name: 'The Daily Ritual', short: 'Return each day and keep your expedition alive.',
    description: 'Check in once per UTC day for 45 XP. Earn 100 bonus XP every 7 consecutive days. Missing a UTC day resets your streak.',
    xp: 45, category: 'Daily', kind: 'daily', tag: 'REPEATABLE', icon: 'sunrise', time: '10 SEC', color: 'green',
    steps: ['Connect your wallet', 'Check in for today (UTC)', 'Come back tomorrow to earn again'],
  },
  {
    targetUrl: X_PROFILE_URL, handle: 'elysiumodyssey', projectName: 'Elysium Odyssey', profileImage: '/public/social-elysiumodyssey.jpg',
    id: 'x-follow', name: 'Join the Odyssey on X', short: 'Visit @elysiumodyssey on X and earn 100 XP.',
    description: 'Connect your X account, then visit @elysiumodyssey to earn 100 XP. Each X account can be linked to one wallet. Following is welcome but is not verified.',
    xp: 100, category: 'Social', kind: 'social', tag: 'VISIT & EARN', icon: 'users', time: '1 MIN', color: 'blue',
    steps: ['Connect your wallet and X account', 'Click Visit X & claim to open @elysiumodyssey', 'Receive 100 XP once per linked account'],
  },
  ...SOCIAL_PROFILES.map(profile => ({
    ...profile, name: `Follow ${profile.projectName} on X`,
    short: `Discover ${profile.projectName} and follow @${profile.handle} on X.`,
    description: `Connect your X account and open @${profile.handle} to follow the project. Earn 100 XP once per linked account by clicking the quest link. Following is not automatically verified.`,
    xp: 100, category: 'Social', kind: 'social', tag: 'ECOSYSTEM', icon: 'users', time: '1 MIN', color: 'blue',
    steps: ['Connect your wallet and X account', `Open @${profile.handle} on X and follow the project`, 'The quest link awards 100 XP once; following is not verified'],
  })),
  {
    id: 'transaction', name: 'Footprints Onchain', short: 'Verify a real, successful Elysium testnet transaction.',
    description: 'Submit the hash of a successful Elysium testnet transaction sent by your connected wallet after joining. Requires testnet HYPE for gas.',
    xp: 260, category: 'Onchain', kind: 'transaction', tag: 'ONCHAIN', icon: 'zap', time: '5 MIN', color: 'pink',
    steps: ['Switch your wallet to Elysium Testnet (99801)', 'Send a testnet transaction from your wallet', 'Enter the transaction hash for server-side verification'],
  },
];

export const QUIZ = [
  { prompt: 'What is the Elysium Testnet chain ID?', answers: ['1338', '42161', '99801', '999'] },
  { prompt: 'Which token pays for gas on Kinetiq Elysium?', answers: ['ETH', 'HYPE', 'SOL', 'LAVA'] },
  { prompt: 'Elysium settles to which network?', answers: ['HyperEVM', 'Ethereum mainnet', 'Solana', 'Base'] },
];

export function levelFromXP(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 150)) + 1;
}
export function levelFloor(level) {
  return Math.pow(Math.max(0, level - 1), 2) * 150;
}
export function formatAddress(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'No wallet';
}


export function weeklyStatus(user = {}, now = new Date()) {
  const start = new Date(now.toISOString().slice(0,10)+'T00:00:00Z');
  start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
  const end = new Date(start.getTime()+7*86400000), key=start.toISOString().slice(0,10);
  const within = at => Number(at)>=start.getTime() && Number(at)<end.getTime();
  const checkins = new Set((user.dailyDates||[]).filter(d=>d>=key && d<end.toISOString().slice(0,10))).size;
  const quests = Object.values(user.completions||{}).filter(within).length + checkins;
  return {key,endsAt:end.toISOString(),quests:[
    {id:'weekly-ritual',name:'Keep the flame alive',description:'Check in on 3 different UTC days this week.',target:3,progress:Math.min(checkins,3),xp:90},
    {id:'weekly-explorer',name:'Keep exploring',description:'Complete 4 quests this week. Daily check-ins count; weekly reward claims do not.',target:4,progress:Math.min(quests,4),xp:120}
  ].map(q=>({...q,claimed:!!user.weeklyClaims?.[key+':'+q.id]}))};
}
export function explorerBadges(user = {}) {
  const completed=user.completions||{}, best=dailyStatus(user.dailyDates||[]).best;
  return [
    {id:'first',name:'First Spark',description:'Complete your first quest',earned:Object.keys(completed).length>0,icon:'sparkles'},
    {id:'streak',name:'Flame Keeper',description:'Reach a 7-day streak',earned:best>=7,icon:'flame'},
    {id:'onchain',name:'Chain Explorer',description:'Complete the onchain quest',earned:!!completed.transaction,icon:'zap'},
    {id:'ecosystem',name:'Ecosystem Scout',description:`Complete all ${SOCIAL_PROFILES.length} ecosystem quests`,earned:SOCIAL_PROFILES.every(p=>!!completed[p.id]),icon:'compass'}
  ];
}
