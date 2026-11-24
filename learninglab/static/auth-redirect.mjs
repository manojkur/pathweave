export function hostSignInTarget(raw, origin) {
  if (!raw) return "";
  try {
    const target = new URL(raw, origin);
    if (target.origin !== origin || target.username || target.password) return "";
    return target.pathname + target.search + target.hash;
  } catch {
    return "";
  }
}
