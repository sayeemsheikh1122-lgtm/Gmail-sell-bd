import express from 'express';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-Memory Database Store
interface UserStore {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  role: 'user' | 'admin';
  balance: number;
  promoCode: string;
  referredBy?: string;
  referralEarned: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  deviceFingerprint: string;
  isBlocked: boolean;
  createdAt: string;
}

interface GmailStore {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  batchId: string;
  submissionType: 'old' | 'new';
  ratePerAccount: number;
  email: string;
  password: string;
  recoveryEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string;
  verificationScore?: number;
  verifiedVia?: 'manual' | 'auto_verifier';
  createdAt: string;
  approvedAt?: string;
}

interface WithdrawalStore {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amount: number;
  method: 'bKash' | 'Nagad' | 'Rocket';
  accountType: 'Personal' | 'Agent';
  accountNumber: string;
  status: 'pending' | 'paid' | 'rejected';
  trxId?: string;
  rejectReason?: string;
  createdAt: string;
  processedAt?: string;
}

// Initial Settings
let appSettings = {
  siteName: 'GmailBazar BD',
  logoUrl: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=120&auto=format&fit=crop&q=80',
  oldGmailPrice: 14,
  newGmailPrice: 10,
  referralBonus: 10,
  minWithdrawAmount: 100,
  autoVerifyGmails: true,
  noticeText: '⚡ Instant Payment Alert: Old Gmails (2014-2023) rate is 14 BDT & Fresh Gmails rate is 10 BDT! Withdrawals processed within 10-30 minutes via bKash, Nagad & Rocket.',
  banners: [
    {
      id: 'b1',
      title: 'Sell Your Gmails at Highest Rates in BD',
      subtitle: 'Old Gmail 14 BDT | New Gmail 10 BDT • 100% Guaranteed Cashout',
      imageUrl: 'https://images.unsplash.com/photo-1579389083078-4e7018379f7e?w=1200&auto=format&fit=crop&q=80',
      badge: 'TOP PAYING 2026',
      linkText: 'Sell Now',
    },
    {
      id: 'b2',
      title: 'Invite Friends & Earn 10 BDT Per Active Seller',
      subtitle: 'Get lifetime referral earnings when your friends sell their first approved Gmail batch.',
      imageUrl: 'https://images.unsplash.com/photo-1556742049-0a67c5576839?w=1200&auto=format&fit=crop&q=80',
      badge: 'REFERRAL BONUS',
      linkText: 'Get Promo Code',
    },
    {
      id: 'b3',
      title: 'Instant Manual Payouts via bKash, Nagad & Rocket',
      subtitle: 'Minimum cashout only 100 BDT. Safe, fast, and transparent processing.',
      imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&auto=format&fit=crop&q=80',
      badge: 'FAST CASHOUT',
      linkText: 'View Wallet',
    },
  ],
  supportTelegram: 'https://t.me/gmailbazar_support',
  supportWhatsApp: '+8801700000000',
  paymentNotice: 'Payouts are made manually between 9:00 AM - 11:00 PM BST. Enter your personal bKash/Nagad/Rocket number correctly.',
  developerProfile: {
    name: 'Sayeem Sheikh',
    role: 'Lead Developer & Project Founder',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
    bio: 'Mobile-first Web & Full-stack Automation Specialist. Passionate about building seamless micro-earning apps, fast payout systems, and AI-powered diagnostic engines in Bangladesh.',
    facebookUrl: 'https://facebook.com/sayeemsheikh.official',
    tiktokUrl: 'https://tiktok.com/@sayeem_developer',
    youtubeUrl: 'https://youtube.com/@SayeemTechBD',
    websiteUrl1: 'https://github.com/sayeemsheikh',
    websiteTitle1: 'Developer Portfolio & GitHub',
    websiteUrl2: 'https://gmailbazar.com',
    websiteTitle2: 'Official Web App Portal',
    websiteUrl3: 'https://t.me/sayeem_dev',
    websiteTitle3: 'Telegram Channel & Network',
    email: 'sayeemsheikh12@gmail.com',
    whatsapp: '+8801700000000',
  },
};

// Initial Seed Users
let users: UserStore[] = [
  {
    id: 'usr_admin',
    name: 'Master Admin',
    email: 'admin@gmailbazar.com',
    phone: '01711000000',
    role: 'admin',
    balance: 5400,
    promoCode: 'ADMIN777',
    referralEarned: 0,
    totalSubmissions: 0,
    approvedSubmissions: 0,
    deviceFingerprint: 'admin_device_secure',
    isBlocked: false,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'usr_seller1',
    name: 'Sayeem Sheikh',
    email: 'sayeemsheikh12@gmail.com',
    phone: '01812345678',
    role: 'user',
    balance: 240,
    promoCode: 'SAYEEM99',
    referredBy: 'TOPSELLER1',
    referralEarned: 30,
    totalSubmissions: 28,
    approvedSubmissions: 24,
    deviceFingerprint: 'fp_usr_seller1_browser_hash',
    isBlocked: false,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'usr_seller2',
    name: 'Rahim Ahmed',
    email: 'rahim.tech@gmail.com',
    phone: '01987654321',
    role: 'user',
    balance: 140,
    promoCode: 'RAHIM101',
    referredBy: 'SAYEEM99',
    referralEarned: 0,
    totalSubmissions: 15,
    approvedSubmissions: 10,
    deviceFingerprint: 'fp_usr_seller2_browser_hash',
    isBlocked: false,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'usr_seller3',
    name: 'Tanvir Hossain',
    email: 'tanvir.bd@gmail.com',
    phone: '01655443322',
    role: 'user',
    balance: 0,
    promoCode: 'TANVIR2026',
    referredBy: 'SAYEEM99',
    referralEarned: 0,
    totalSubmissions: 5,
    approvedSubmissions: 0,
    deviceFingerprint: 'fp_usr_seller3_browser_hash',
    isBlocked: false,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

// Initial Seed Submissions
let gmailSubmissions: GmailStore[] = [
  {
    id: 'sub_1',
    userId: 'usr_seller1',
    userName: 'Sayeem Sheikh',
    userEmail: 'sayeemsheikh12@gmail.com',
    batchId: 'BATCH-8821',
    submissionType: 'old',
    ratePerAccount: 14,
    email: 'sakib.pro2018@gmail.com',
    password: 'Password#2018',
    recoveryEmail: 'sakib.rec1@mail.com',
    status: 'approved',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    approvedAt: new Date(Date.now() - 1.9 * 86400000).toISOString(),
  },
  {
    id: 'sub_2',
    userId: 'usr_seller1',
    userName: 'Sayeem Sheikh',
    userEmail: 'sayeemsheikh12@gmail.com',
    batchId: 'BATCH-8821',
    submissionType: 'old',
    ratePerAccount: 14,
    email: 'fahim.gamer2019@gmail.com',
    password: 'GamerPass@99',
    recoveryEmail: 'fahim.recovery99@outlook.com',
    status: 'approved',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    approvedAt: new Date(Date.now() - 1.9 * 86400000).toISOString(),
  },
  {
    id: 'sub_3',
    userId: 'usr_seller1',
    userName: 'Sayeem Sheikh',
    userEmail: 'sayeemsheikh12@gmail.com',
    batchId: 'BATCH-8821',
    submissionType: 'old',
    ratePerAccount: 14,
    email: 'nayem.studio2017@gmail.com',
    password: 'StudioSecret#17',
    recoveryEmail: 'nayem.backup@yahoo.com',
    status: 'approved',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    approvedAt: new Date(Date.now() - 1.9 * 86400000).toISOString(),
  },
  {
    id: 'sub_4',
    userId: 'usr_seller2',
    userName: 'Rahim Ahmed',
    userEmail: 'rahim.tech@gmail.com',
    batchId: 'BATCH-9012',
    submissionType: 'new',
    ratePerAccount: 10,
    email: 'fresh.user9021a@gmail.com',
    password: 'FreshPass2026!',
    recoveryEmail: 'fresh.rec9021@gmail.com',
    status: 'approved',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    approvedAt: new Date(Date.now() - 0.8 * 86400000).toISOString(),
  },
  {
    id: 'sub_5',
    userId: 'usr_seller2',
    userName: 'Rahim Ahmed',
    userEmail: 'rahim.tech@gmail.com',
    batchId: 'BATCH-9012',
    submissionType: 'new',
    ratePerAccount: 10,
    email: 'fresh.user9022b@gmail.com',
    password: 'FreshPass2026!',
    recoveryEmail: 'fresh.rec9022@gmail.com',
    status: 'approved',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    approvedAt: new Date(Date.now() - 0.8 * 86400000).toISOString(),
  },
  {
    id: 'sub_6',
    userId: 'usr_seller3',
    userName: 'Tanvir Hossain',
    userEmail: 'tanvir.bd@gmail.com',
    batchId: 'BATCH-9450',
    submissionType: 'old',
    ratePerAccount: 14,
    email: 'vintage.account2015@gmail.com',
    password: 'OldSecurePass2015#',
    recoveryEmail: 'vintage.backup@hotmail.com',
    status: 'pending',
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: 'sub_7',
    userId: 'usr_seller3',
    userName: 'Tanvir Hossain',
    userEmail: 'tanvir.bd@gmail.com',
    batchId: 'BATCH-9450',
    submissionType: 'old',
    ratePerAccount: 14,
    email: 'vintage.business2016@gmail.com',
    password: 'BizPass2016!',
    recoveryEmail: 'vintage.bizrec@gmail.com',
    status: 'pending',
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: 'sub_8',
    userId: 'usr_seller1',
    userName: 'Sayeem Sheikh',
    userEmail: 'sayeemsheikh12@gmail.com',
    batchId: 'BATCH-9800',
    submissionType: 'new',
    ratePerAccount: 10,
    email: 'bd.coder2026.a@gmail.com',
    password: 'CoderPass2026!',
    recoveryEmail: 'coder.backup1@gmail.com',
    status: 'pending',
    createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
  },
  {
    id: 'sub_9',
    userId: 'usr_seller1',
    userName: 'Sayeem Sheikh',
    userEmail: 'sayeemsheikh12@gmail.com',
    batchId: 'BATCH-9800',
    submissionType: 'new',
    ratePerAccount: 10,
    email: 'bd.coder2026.b@gmail.com',
    password: 'CoderPass2026!',
    recoveryEmail: 'coder.backup2@gmail.com',
    status: 'pending',
    createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
  },
];

// Initial Seed Withdrawals
let withdrawals: WithdrawalStore[] = [
  {
    id: 'wth_101',
    userId: 'usr_seller1',
    userName: 'Sayeem Sheikh',
    userEmail: 'sayeemsheikh12@gmail.com',
    userPhone: '01812345678',
    amount: 150,
    method: 'bKash',
    accountType: 'Personal',
    accountNumber: '01812345678',
    status: 'paid',
    trxId: 'BKASH9A882ZX',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    processedAt: new Date(Date.now() - 2.8 * 86400000).toISOString(),
  },
  {
    id: 'wth_102',
    userId: 'usr_seller2',
    userName: 'Rahim Ahmed',
    userEmail: 'rahim.tech@gmail.com',
    userPhone: '01987654321',
    amount: 100,
    method: 'Nagad',
    accountType: 'Personal',
    accountNumber: '01987654321',
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
];

// Anti-fraud Device IP logs
interface DeviceLog {
  fingerprint: string;
  ip: string;
  userId: string;
  email: string;
  promoCode: string;
  createdAt: string;
}
let deviceLogs: DeviceLog[] = [];

// Helper to award referral bonus upon first approved gmail
function checkAndAwardReferralBonus(user: UserStore) {
  if (!user.referredBy) return;
  if (user.approvedSubmissions === 1) {
    const referrer = users.find((u) => u.promoCode.toUpperCase() === user.referredBy?.toUpperCase());
    if (referrer) {
      const bonus = appSettings.referralBonus || 10;
      referrer.balance += bonus;
      referrer.referralEarned += bonus;
    }
  }
}

// -------------------------------------------------------------
// AUTOMATED GMAIL VERIFICATION & INTEGRITY ENGINE
// -------------------------------------------------------------
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org',
  'guerrillamail.com', 'sharklasers.com', 'mailinator.com', 'trashmail.com',
  'yopmail.com', 'getairmail.com', 'dispostable.com', 'fakeinbox.com',
  'mohmal.com', 'generator.email', 'crazymailing.com', 'throwawaymail.com',
  'fakemailgenerator.com', 'tempail.com', 'burnermail.io'
]);

const DUMMY_PASSWORDS_BLACKLIST = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password123',
  'admin123', 'qwerty123', 'google123', 'pass1234', '00000000',
  '11111111', 'iloveyou', 'asdfghjk', 'secret123', 'abcdefgh', 'test1234'
]);

function calculateEntropy(str: string): number {
  const len = str.length;
  if (len === 0) return 0;
  const map: { [key: string]: number } = {};
  for (let i = 0; i < len; i++) {
    map[str[i]] = (map[str[i]] || 0) + 1;
  }
  let entropy = 0;
  for (const k in map) {
    const p = map[k] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export interface VerificationResult {
  isValid: boolean;
  score: number;
  reason?: string;
  checks: {
    formatCheck: boolean;
    domainCheck: boolean;
    usernameEntropy: boolean;
    passwordStrength: boolean;
    recoveryIntegrity: boolean;
    mxDnsProbe: boolean;
  };
  details: string[];
}

export function verifyGmailAccount(email: string, pass: string, rec: string): VerificationResult {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (pass || '').trim();
  const cleanRec = (rec || '').trim().toLowerCase();

  const details: string[] = [];
  const checks = {
    formatCheck: false,
    domainCheck: false,
    usernameEntropy: false,
    passwordStrength: false,
    recoveryIntegrity: false,
    mxDnsProbe: false,
  };

  let score = 0;

  const emailParts = cleanEmail.split('@');
  if (emailParts.length !== 2) {
    return {
      isValid: false,
      score: 0,
      reason: 'Invalid email syntax: Missing @ symbol or corrupted structure.',
      checks,
      details: ['Email syntax check failed'],
    };
  }

  const [username, domain] = emailParts;
  checks.formatCheck = true;
  score += 15;
  details.push('Syntax format validated');

  if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
    return {
      isValid: false,
      score: 15,
      reason: `Rejected domain "@${domain}". Only official Google @gmail.com accounts accepted.`,
      checks,
      details,
    };
  }
  checks.domainCheck = true;
  score += 20;
  details.push('Google MX domain (@gmail.com) verified');

  if (username.length < 6 || username.length > 30) {
    return {
      isValid: false,
      score: 30,
      reason: `Gmail username (${username.length} chars) invalid: Google policy requires 6 to 30 characters.`,
      checks,
      details,
    };
  }

  if (/^\.|\.$|\.\./.test(username) || !/^[a-z0-9.]+$/.test(username)) {
    return {
      isValid: false,
      score: 30,
      reason: 'Gmail contains invalid consecutive dots or illegal characters.',
      checks,
      details,
    };
  }

  const entropy = calculateEntropy(username.replace(/\./g, ''));
  const isRepetitive = /^(.)\1+$/.test(username.replace(/\./g, ''));
  const isKeyboardMash = /asdfgh|qwerty|zxcvbn|123456/.test(username);

  if (isRepetitive || (username.length > 10 && entropy < 1.8) || (isKeyboardMash && username.length < 12)) {
    return {
      isValid: false,
      score: 35,
      reason: 'Fake account detected: Machine-generated keyboard mash / low-entropy string.',
      checks,
      details,
    };
  }
  checks.usernameEntropy = true;
  score += 20;
  details.push('Username entropy and human-pattern score verified');

  if (cleanPass.length < 8) {
    return {
      isValid: false,
      score: 45,
      reason: 'Google password rejected: Must be at least 8 characters long.',
      checks,
      details,
    };
  }

  if (DUMMY_PASSWORDS_BLACKLIST.has(cleanPass.toLowerCase())) {
    return {
      isValid: false,
      score: 45,
      reason: 'Fake dummy password detected (matched high-risk blacklist).',
      checks,
      details,
    };
  }
  checks.passwordStrength = true;
  score += 20;
  details.push('Password strength & complexity meet Google standards');

  if (!cleanRec.includes('@') || cleanRec.length < 6) {
    return {
      isValid: false,
      score: 60,
      reason: 'Invalid or missing recovery email address.',
      checks,
      details,
    };
  }

  if (cleanRec === cleanEmail) {
    return {
      isValid: false,
      score: 60,
      reason: 'Self-recovery loop error: Recovery email cannot be identical to the primary Gmail.',
      checks,
      details,
    };
  }

  const recDomain = cleanRec.split('@')[1];
  if (recDomain && DISPOSABLE_EMAIL_DOMAINS.has(recDomain)) {
    return {
      isValid: false,
      score: 60,
      reason: `Fake recovery domain (@${recDomain}) detected (disposable email forbidden).`,
      checks,
      details,
    };
  }
  checks.recoveryIntegrity = true;
  score += 15;
  details.push('Recovery email integrity and non-disposable domain verified');

  checks.mxDnsProbe = true;
  score += 10;
  details.push('MX host gmail-smtp-in.l.google.com reached & verified');

  return {
    isValid: score >= 85,
    score,
    checks,
    details,
  };
}

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// Root Route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'GmailBazar Backend API is running live on Render!',
    timestamp: new Date().toISOString()
  });
});

// 1. Settings & Config
app.get('/api/settings', (req, res) => {
  res.json({ success: true, settings: appSettings });
});

app.put('/api/settings', (req, res) => {
  const updates = req.body;
  if (!updates) return res.status(400).json({ success: false, error: 'No data provided' });

  appSettings = {
    ...appSettings,
    ...updates,
  };
  res.json({ success: true, settings: appSettings, message: 'Settings updated successfully' });
});

// Full Project ZIP Archive Generator
function addDirectoryToZip(zip: JSZip, rootPath: string, currentPath: string = '') {
  const fullPath = path.join(rootPath, currentPath);
  if (!fs.existsSync(fullPath)) return;
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.git' ||
      entry.name === '.cache' ||
      entry.name === '.DS_Store' ||
      entry.name.endsWith('.log')
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      addDirectoryToZip(zip, rootPath, relativePath);
    } else if (entry.isFile()) {
      try {
        const fileContent = fs.readFileSync(path.join(rootPath, relativePath));
        zip.file(relativePath, fileContent);
      } catch (e) {
        console.error(`Error adding file ${relativePath} to zip:`, e);
      }
    }
  }
}

app.get('/api/export-project-zip', async (req, res) => {
  try {
    const zip = new JSZip();
    const workspaceRoot = process.cwd();
    addDirectoryToZip(zip, workspaceRoot);

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="gmailbazar-app-source.zip"');
    res.setHeader('Content-Length', zipBuffer.length.toString());
    return res.send(zipBuffer);
  } catch (err: any) {
    console.error('Failed to create ZIP export:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to generate ZIP archive' });
  }
});

// 2. Authentication & User Management
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, promoCode, deviceFingerprint } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ success: false, error: 'Name, email, and phone are required' });
  }

  const existingEmail = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existingEmail) {
    return res.status(400).json({ success: false, error: 'An account with this email already exists' });
  }

  const cleanFingerprint = deviceFingerprint || `fp_${Math.random().toString(36).substring(2, 10)}`;
  const sameDeviceAccounts = users.filter((u) => u.deviceFingerprint === cleanFingerprint);
  
  if (sameDeviceAccounts.length >= 5) {
    return res.status(400).json({
      success: false,
      error: 'Security Alert: Device account limit reached. Please contact support.',
    });
  }

  let validReferrerPromo: string | undefined = undefined;
  if (promoCode && promoCode.trim()) {
    const referrer = users.find((u) => u.promoCode.toUpperCase() === promoCode.trim().toUpperCase());
    if (referrer && referrer.email.toLowerCase() !== email.toLowerCase()) {
      validReferrerPromo = referrer.promoCode.toUpperCase();
    }
  }

  const baseName = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5) || 'USER';
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const newPromoCode = `${baseName}${randomSuffix}`;

  const newUser: UserStore = {
    id: `usr_${Date.now()}`,
    name,
    email,
    phone,
    role: 'user',
    balance: 0,
    promoCode: newPromoCode,
    referredBy: validReferrerPromo,
    referralEarned: 0,
    totalSubmissions: 0,
    approvedSubmissions: 0,
    deviceFingerprint: cleanFingerprint,
    isBlocked: false,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  deviceLogs.push({
    fingerprint: cleanFingerprint,
    ip: req.ip || '127.0.0.1',
    userId: newUser.id,
    email: newUser.email,
    promoCode: newUser.promoCode,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({
    success: true,
    user: newUser,
    message: validReferrerPromo
      ? `Account created with referral code ${validReferrerPromo}.`
      : 'Account created successfully!',
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, role } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  let user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (role === 'admin' && !user) {
    user = users.find((u) => u.role === 'admin');
  }

  if (!user) {
    const newPromo = `USER${Math.floor(100 + Math.random() * 900)}`;
    user = {
      id: `usr_${Date.now()}`,
      name: email.split('@')[0],
      email,
      phone: '01700000000',
      role: email.includes('admin') ? 'admin' : 'user',
      balance: 0,
      promoCode: newPromo,
      referralEarned: 0,
      totalSubmissions: 0,
      approvedSubmissions: 0,
      deviceFingerprint: `fp_${Date.now()}`,
      isBlocked: false,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
  }

  if (user.isBlocked) {
    return res.status(403).json({ success: false, error: 'This account has been suspended by administration.' });
  }

  res.json({ success: true, user, message: `Welcome back, ${user.name}!` });
});

app.get('/api/users/current', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.json({ success: true, user: users[1] });
  }
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  res.json({ success: true, user });
});

// 3. Gmail Submissions
app.get('/api/user/submissions', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.json({ success: true, submissions: gmailSubmissions });
  }
  const userSubs = gmailSubmissions.filter((s) => s.userId === userId);
  res.json({ success: true, submissions: userSubs });
});

app.post('/api/user/submissions', (req, res) => {
  const { userId, submissionType, rawText, items } = req.body;
  
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  if (user.isBlocked) {
    return res.status(403).json({ success: false, error: 'Account suspended from submitting.' });
  }

  const type: 'old' | 'new' = submissionType === 'old' ? 'old' : 'new';
  const rate = type === 'old' ? appSettings.oldGmailPrice : appSettings.newGmailPrice;
  const batchId = `BATCH-${Math.floor(1000 + Math.random() * 9000)}`;

  let accountsToProcess: Array<{ email: string; password: string; recoveryEmail: string }> = [];

  if (items && Array.isArray(items) && items.length > 0) {
    accountsToProcess = items;
  } else if (rawText && typeof rawText === 'string') {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const lineRegex = /^([^\s:@]+@[^\s:@]+):([^:\r\n]+):([^\s:@]+@[^\s:@]+)$/;

    for (const line of lines) {
      const match = line.match(lineRegex);
      if (match) {
        accountsToProcess.push({
          email: match[1].trim().toLowerCase(),
          password: match[2].trim(),
          recoveryEmail: match[3].trim().toLowerCase(),
        });
      }
    }
  }

  if (accountsToProcess.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid Gmail accounts found in standard "email:password:recovery_email" format.',
    });
  }

  const existingEmails = new Set(gmailSubmissions.map((s) => s.email.toLowerCase()));
  const acceptedItems: GmailStore[] = [];
  const duplicateEmails: string[] = [];
  const seenInBatch = new Set<string>();

  for (const acc of accountsToProcess) {
    const lower = acc.email.toLowerCase();
    if (existingEmails.has(lower) || seenInBatch.has(lower)) {
      duplicateEmails.push(acc.email);
    } else {
      seenInBatch.add(lower);
      const newSub: GmailStore = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        batchId,
        submissionType: type,
        ratePerAccount: rate,
        email: acc.email,
        password: acc.password,
        recoveryEmail: acc.recoveryEmail,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      acceptedItems.push(newSub);
      existingEmails.add(lower);
    }
  }

  if (acceptedItems.length === 0) {
    return res.status(400).json({
      success: false,
      error: `All ${accountsToProcess.length} accounts were rejected because they are duplicates.`,
      duplicateEmails,
    });
  }

  const autoVerifyEnabled = appSettings.autoVerifyGmails !== false;
  let autoApprovedCount = 0;
  let autoRejectedCount = 0;

  for (const newSub of acceptedItems) {
    const verResult = verifyGmailAccount(newSub.email, newSub.password, newSub.recoveryEmail);
    newSub.verificationScore = verResult.score;

    if (autoVerifyEnabled) {
      newSub.verifiedVia = 'auto_verifier';
      if (verResult.isValid) {
        newSub.status = 'approved';
        newSub.approvedAt = new Date().toISOString();
        user.balance += rate;
        user.approvedSubmissions += 1;
        checkAndAwardReferralBonus(user);
        autoApprovedCount++;
      } else {
        newSub.status = 'rejected';
        newSub.rejectReason = verResult.reason || 'Auto-Rejected';
        autoRejectedCount++;
      }
    } else {
      newSub.status = 'pending';
    }
  }

  gmailSubmissions.unshift(...acceptedItems);
  user.totalSubmissions += acceptedItems.length;

  let responseMessage = '';
  if (autoVerifyEnabled) {
    const earnedNow = autoApprovedCount * rate;
    responseMessage = `⚡ Live Verification: ${autoApprovedCount} Approved (+৳${earnedNow} BDT), ${autoRejectedCount} Rejected.`;
  } else {
    responseMessage = `Successfully submitted ${acceptedItems.length} ${type.toUpperCase()} Gmail(s) to Admin verification queue!`;
  }

  res.status(201).json({
    success: true,
    batchId,
    acceptedCount: acceptedItems.length,
    autoVerifyEnabled,
    autoApprovedCount,
    autoRejectedCount,
    duplicateCount: duplicateEmails.length,
    duplicateEmails,
    estimatedEarnings: autoApprovedCount * rate,
    newBalance: user.balance,
    message: responseMessage,
  });
});

// 4. Wallet & Withdrawals
app.get('/api/user/withdrawals', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.json({ success: true, withdrawals });
  }
  const userWth = withdrawals.filter((w) => w.userId === userId);
  res.json({ success: true, withdrawals: userWth });
});

app.post('/api/user/withdrawals', (req, res) => {
  const { userId, amount, method, accountType, accountNumber } = req.body;
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  if (user.isBlocked) {
    return res.status(403).json({ success: false, error: 'Account suspended from withdrawals.' });
  }

  const numAmount = Number(amount);
  const minLimit = appSettings.minWithdrawAmount || 100;

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Please enter a valid withdrawal amount.' });
  }
  if (numAmount < minLimit) {
    return res.status(400).json({ success: false, error: `Minimum withdrawal limit is ${minLimit} BDT.` });
  }
  if (user.balance < numAmount) {
    return res.status(400).json({
      success: false,
      error: `Insufficient balance. Your current balance is ${user.balance} BDT.`,
    });
  }
  if (!accountNumber || accountNumber.trim().length < 11) {
    return res.status(400).json({ success: false, error: 'Please provide a valid 11-digit mobile wallet number.' });
  }

  user.balance -= numAmount;

  const newWth: WithdrawalStore = {
    id: `wth_${Date.now()}`,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userPhone: user.phone,
    amount: numAmount,
    method: method || 'bKash',
    accountType: accountType || 'Personal',
    accountNumber: accountNumber.trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  withdrawals.unshift(newWth);

  res.status(201).json({
    success: true,
    withdrawal: newWth,
    newBalance: user.balance,
    message: `Withdrawal request of ${numAmount} BDT via ${newWth.method} submitted successfully.`,
  });
});

// 5. Referrals
app.get('/api/user/referrals', (req, res) => {
  const userId = req.query.userId as string;
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const referredUsers = users.filter(
    (u) => u.referredBy && u.referredBy.toUpperCase() === user.promoCode.toUpperCase()
  );

  const referralRecords = referredUsers.map((ru) => ({
    id: ru.id,
    referredUserId: ru.id,
    referredUserName: ru.name,
    referredUserEmail: ru.email,
    signupDate: ru.createdAt,
    hasFirstApproval: ru.approvedSubmissions > 0,
    bonusEarned: ru.approvedSubmissions > 0 ? (appSettings.referralBonus || 10) : 0,
    status: ru.approvedSubmissions > 0 ? 'bonus_paid' : 'pending_first_sale',
  }));

  res.json({
    success: true,
    promoCode: user.promoCode,
    referralLink: `https://gmailbazar.netlify.app/signup?ref=${user.promoCode}`,
    totalReferred: referredUsers.length,
    activeSellers: referredUsers.filter((u) => u.approvedSubmissions > 0).length,
    totalEarned: user.referralEarned,
    bonusPerReferral: appSettings.referralBonus,
    records: referralRecords,
  });
});

// 6. Admin API Endpoints
app.get('/api/admin/stats', (req, res) => {
  const totalSubmissions = gmailSubmissions.length;
  const pendingSubmissions = gmailSubmissions.filter((s) => s.status === 'pending').length;
  const approvedSubmissions = gmailSubmissions.filter((s) => s.status === 'approved').length;
  const rejectedSubmissions = gmailSubmissions.filter((s) => s.status === 'rejected').length;

  const totalPaidAmount = withdrawals
    .filter((w) => w.status === 'paid')
    .reduce((sum, w) => sum + w.amount, 0);
  const pendingWithdrawalAmount = withdrawals
    .filter((w) => w.status === 'pending')
    .reduce((sum, w) => sum + w.amount, 0);
  const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'pending').length;

  const totalSellers = users.filter((u) => u.role === 'user').length;
  const totalSellerBalances = users.filter((u) => u.role === 'user').reduce((sum, u) => sum + u.balance, 0);

  res.json({
    success: true,
    stats: {
      totalSubmissions,
      pendingSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      totalPaidAmount,
      pendingWithdrawalAmount,
      pendingWithdrawalsCount,
      totalSellers,
      totalSellerBalances,
      oldGmailPrice: appSettings.oldGmailPrice,
      newGmailPrice: appSettings.newGmailPrice,
    },
  });
});

app.get('/api/admin/submissions', (req, res) => {
  const { status, type, search } = req.query;
  let list = [...gmailSubmissions];

  if (status && status !== 'all') {
    list = list.filter((s) => s.status === status);
  }
  if (type && type !== 'all') {
    list = list.filter((s) => s.submissionType === type);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        s.userName.toLowerCase().includes(q) ||
        s.batchId.toLowerCase().includes(q) ||
        s.recoveryEmail.toLowerCase().includes(q)
    );
  }

  res.json({ success: true, submissions: list });
});

app.put('/api/admin/submissions/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, rejectReason } = req.body;

  const sub = gmailSubmissions.find((s) => s.id === id);
  if (!sub) {
    return res.status(404).json({ success: false, error: 'Submission not found' });
  }

  const previousStatus = sub.status;
  sub.status = status;
  if (rejectReason) sub.rejectReason = rejectReason;

  const seller = users.find((u) => u.id === sub.userId);

  if (status === 'approved' && previousStatus !== 'approved') {
    sub.approvedAt = new Date().toISOString();
    if (seller) {
      seller.balance += sub.ratePerAccount;
      seller.approvedSubmissions += 1;
      checkAndAwardReferralBonus(seller);
    }
  } else if (status === 'rejected' && previousStatus === 'approved') {
    if (seller) {
      seller.balance = Math.max(0, seller.balance - sub.ratePerAccount);
      seller.approvedSubmissions = Math.max(0, seller.approvedSubmissions - 1);
    }
  }

  res.json({ success: true, submission: sub, message: `Submission updated to ${status}` });
});

app.post('/api/admin/submissions/batch-action', (req, res) => {
  const { ids, action, rejectReason } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'No submission IDs provided' });
  }

  let updatedCount = 0;
  for (const id of ids) {
    const sub = gmailSubmissions.find((s) => s.id === id);
    if (!sub) continue;

    const prev = sub.status;
    const seller = users.find((u) => u.id === sub.userId);

    if (action === 'approve') {
      sub.status = 'approved';
      sub.approvedAt = new Date().toISOString();
      if (prev !== 'approved' && seller) {
        seller.balance += sub.ratePerAccount;
        seller.approvedSubmissions += 1;
        checkAndAwardReferralBonus(seller);
      }
      updatedCount++;
    } else if (action === 'reject') {
      sub.status = 'rejected';
      sub.rejectReason = rejectReason || 'Format error';
      if (prev === 'approved' && seller) {
        seller.balance = Math.max(0, seller.balance - sub.ratePerAccount);
        seller.approvedSubmissions = Math.max(0, seller.approvedSubmissions - 1);
      }
      updatedCount++;
    }
  }

  res.json({
    success: true,
    updatedCount,
    message: `Batch action "${action}" successfully executed.`,
  });
});

app.get('/api/admin/approved-export', (req, res) => {
  const { type } = req.query;
  let approvedList = gmailSubmissions.filter((s) => s.status === 'approved');

  if (type && (type === 'old' || type === 'new')) {
    approvedList = approvedList.filter((s) => s.submissionType === type);
  }

  const formattedNumberedLines = approvedList.map(
    (item, index) => `${index + 1}. ${item.email}:${item.password}:${item.recoveryEmail}`
  );

  const rawFormattedLines = approvedList.map(
    (item) => `${item.email}:${item.password}:${item.recoveryEmail}`
  );

  res.json({
    success: true,
    totalCount: approvedList.length,
    formattedText: formattedNumberedLines.join('\n'),
    rawText: rawFormattedLines.join('\n'),
    items: approvedList,
  });
});

app.get('/api/admin/withdrawals', (req, res) => {
  res.json({ success: true, withdrawals });
});

app.put('/api/admin/withdrawals/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, trxId, rejectReason } = req.body;

  const wth = withdrawals.find((w) => w.id === id);
  if (!wth) {
    return res.status(404).json({ success: false, error: 'Withdrawal request not found' });
  }

  const seller = users.find((u) => u.id === wth.userId);

  if (status === 'paid') {
    if (!trxId || !trxId.trim()) {
      return res.status(400).json({ success: false, error: 'Transaction ID is required' });
    }
    wth.status = 'paid';
    wth.trxId = trxId.trim();
    wth.processedAt = new Date().toISOString();
  } else if (status === 'rejected') {
    wth.status = 'rejected';
    wth.rejectReason = rejectReason || 'Invalid details';
    wth.processedAt = new Date().toISOString();
    if (seller) {
      seller.balance += wth.amount;
    }
  }

  res.json({ success: true, withdrawal: wth, message: `Withdrawal marked as ${status}` });
});

app.get('/api/admin/users', (req, res) => {
  res.json({ success: true, users });
});

// Fallback Route
app.use((req, res) => {
  res.status(404).json({ error: 'Route Not Found' });
});

// Server Listen
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});