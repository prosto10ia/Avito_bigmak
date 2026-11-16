const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{36}/,
  /avito_secret_[a-zA-Z0-9]+/,
];

export function inspectForSecrets(value: string) {
  const match = SECRET_PATTERNS.find((pattern) => pattern.test(value));
  return match
    ? { blocked: true, reason: 'В тексте обнаружен секрет или приватный ключ.' }
    : { blocked: false };
}
