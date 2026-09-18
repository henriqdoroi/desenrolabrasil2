import { neon } from '@neondatabase/serverless';

let _sql;
let _initPromise;

export function sql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL nao configurada');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export async function ensureSchema() {
  if (!_initPromise) {
    const s = sql();
    _initPromise = (async () => {
      await s`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          external_reference TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING',
          amount_cents INTEGER NOT NULL,
          fee_cents INTEGER,
          net_cents INTEGER,
          customer_name TEXT,
          customer_email TEXT,
          customer_cpf TEXT,
          customer_phone TEXT,
          pix_copy_paste TEXT,
          utm JSONB,
          acordo TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          paid_at TIMESTAMPTZ
        )
      `;
      // Keep older Neon databases compatible with the current application schema.
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING'`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_cents INTEGER NOT NULL DEFAULT 0`;
      // CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_reference TEXT`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fee_cents INTEGER`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS net_cents INTEGER`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_name TEXT`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_email TEXT`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_cpf TEXT`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_phone TEXT`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS utm JSONB`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS acordo TEXT`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;
      await s`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`;
      await s`CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status)`;
      await s`CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC)`;
      await s`
        CREATE TABLE IF NOT EXISTS comprovantes (
          id BIGSERIAL PRIMARY KEY,
          transaction_id TEXT,
          cpf TEXT,
          nome TEXT,
          acordo TEXT,
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          data BYTEA NOT NULL,
          size_bytes INTEGER NOT NULL,
          uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await s`CREATE INDEX IF NOT EXISTS idx_comp_tx ON comprovantes(transaction_id)`;
      await s`CREATE INDEX IF NOT EXISTS idx_comp_uploaded ON comprovantes(uploaded_at DESC)`;
    })().catch(err => { _initPromise = null; throw err; });
  }
  return _initPromise;
}
