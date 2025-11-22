const STORAGE_KEY = "cloudimgs_password";
const SALT = "cloudimgs-salt-2025";

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
    localStorage.setItem(STORAGE_KEY, `v1:${b64}`);
  } catch (e) {
    localStorage.setItem(STORAGE_KEY, plain);
  }
}

export function getPassword() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    if (stored.startsWith("v1:")) {
      const b64 = stored.slice(3);
      const x = atob(b64);
      return xorCipher(x);
    }
    return stored;
  } catch (e) {
    return localStorage.getItem(STORAGE_KEY);
  }
}

export function clearPassword() {
  localStorage.removeItem(STORAGE_KEY);
}