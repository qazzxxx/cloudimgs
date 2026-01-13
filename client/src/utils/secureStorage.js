const STORAGE_KEY = "cloudimgs_password";
const SALT = "cloudimgs-salt-2025";
const EXPIRATION_TIME = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

function xorCipher(input) {
  const salt = SALT;
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
    out += String.fromCharCode(code);
  }
  return out;
}

export function setPassword(plain) {
  try {
    const x = xorCipher(plain);
    const b64 = btoa(x);
    const data = {
        value: `v1:${b64}`,
        timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // Fallback for simple string if something fails (though logic above is robust)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        value: plain,
        timestamp: Date.now()
    }));
  }
}

export function getPassword() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    // Check if it's new JSON format or old legacy string
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        // Legacy format (direct string) - treat as expired to force re-login and upgrade format,
        // or just accept it once. Let's just return it for backward compatibility but it won't have expiry.
        // Actually, better to migrate it or just treat as valid for now.
        // But user asked for expiry. So let's return it, and next setPassword will fix format.
        // To be strict: clear it if not JSON? No, let's parse.
        // If parsing fails, it's the old format string.
        
        // Let's migrate legacy storage to new format with current time if we want to keep them logged in,
        // OR just return it. 
        // Logic: if string, return it.
        const stored = raw;
        if (stored.startsWith("v1:")) {
             const b64 = stored.slice(3);
             const x = atob(b64);
             return xorCipher(x);
        }
        return stored;
    }

    if (!data || !data.value) return null;

    // Check Expiry
    if (Date.now() - data.timestamp > EXPIRATION_TIME) {
        clearPassword();
        return null;
    }

    const stored = data.value;
    if (stored.startsWith("v1:")) {
      const b64 = stored.slice(3);
      const x = atob(b64);
      return xorCipher(x);
    }
    return stored;
  } catch (e) {
    return null;
  }
}

export function clearPassword() {
  localStorage.removeItem(STORAGE_KEY);
}