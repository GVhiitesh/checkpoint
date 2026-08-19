import 'dotenv/config';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    console.warn(`[config] Missing env var ${name}`);
  }
  return value;
}

function resolveDatabaseUrl() {
  let url = process.env.DATABASE_URL ?? '';
  const sep = process.env.DB_PASSWORD;
  if (sep) {
    url = url.replace('[YOUR-PASSWORD]', encodeURIComponent(sep));
  }
  return url;
}

export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  databaseUrl: resolveDatabaseUrl(),
  jwtSecret: required('JWT_SECRET', '039597d97b7642a503a3bef0b3dfd46daa8578e7f2521eff248c5e869befa69f'),
  qrHmacSecret: required('QR_HMAC_SECRET', '65a5a9f27f65cda4a60e6d3e4ec5ad484ec69e8d777fde4f156920e49b7975b9'),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  clientOrigin: process.env.CLIENT_ORIGIN ?? '*',
  qrWindowMs: 30_000,
  organizerProvisionKey: process.env.ORGANIZER_PROVISION_KEY ?? 'checkpoint_org_key_2026',
};
