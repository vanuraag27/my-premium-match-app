// Ensure storage instances survive across Next.js compilation hot-reloads
const globalForDb = global;

if (!globalForDb.tempOtpStore) {
  globalForDb.tempOtpStore = new Map();
}
if (!globalForDb.userDatabase) {
  globalForDb.userDatabase = new Map();
}

export const tempOtpStore = globalForDb.tempOtpStore;
export const userDatabase = globalForDb.userDatabase;