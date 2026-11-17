-- One PostgreSQL instance. Replication lag and quorum are paper exercises.
-- Table ownership is still split by service name in the comments.

CREATE TABLE orders (
  id uuid PRIMARY KEY,
  checkout_session_id text UNIQUE,
  product_id text NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL,
  payment_intent_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE idempotency_keys (
  principal_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('PROCESSING', 'SUCCEEDED', 'FAILED')),
  response jsonb,
  lease_until timestamptz NOT NULL,
  fencing_token bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (principal_id, idempotency_key)
);

CREATE TABLE inventory (
  product_id text PRIMARY KEY,
  quantity integer NOT NULL CHECK (quantity >= 0),
  version integer NOT NULL DEFAULT 0
);

INSERT INTO inventory (product_id, quantity) VALUES
  ('flash-sku', 1),
  ('bulk-sku', 1000),
  ('catalog-sku', 50);

CREATE TABLE outbox (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL UNIQUE,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  published_at timestamptz
);

CREATE INDEX outbox_unpublished ON outbox (id) WHERE published_at IS NULL;

CREATE TABLE processed_messages (
  message_id uuid PRIMARY KEY,
  effect text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  intent_id text PRIMARY KEY,
  order_id uuid,
  amount integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE leases (
  lock_name text PRIMARY KEY,
  owner text NOT NULL,
  fencing_token bigint NOT NULL,
  lease_until timestamptz NOT NULL
);

CREATE TABLE balances (
  account_id text PRIMARY KEY,
  amount integer NOT NULL,
  accepted_token bigint NOT NULL DEFAULT 0
);

INSERT INTO balances (account_id, amount) VALUES ('acct-1', 0);

CREATE TABLE products (
  sku text PRIMARY KEY,
  name text NOT NULL
);

INSERT INTO products (sku, name) VALUES
  ('flash-sku', 'Flash unit'),
  ('bulk-sku', 'Bulk unit'),
  ('catalog-sku', 'Catalog unit');
