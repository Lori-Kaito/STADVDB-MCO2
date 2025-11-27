#!/usr/bin/env bash
set -euo pipefail

echo "Starting primary and hot backup containers..."
docker compose up -d db_primary db_hot_backup

echo "Waiting a bit for Postgres to initialize..."
sleep 5

echo "Configuring pg_hba.conf on primary for replication..."
docker exec -u postgres db_primary bash -c "
  if ! grep -q 'host replication postgres' /var/lib/postgresql/data/pg_hba.conf; then
    echo 'host replication postgres 0.0.0.0/0 trust' >> /var/lib/postgresql/data/pg_hba.conf
  fi
  /usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/data reload
"

echo "Resetting hot backup data directory..."
docker exec -u postgres db_hot_backup bash -c "
  /usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/data stop || echo 'standby already stopped';
  rm -rf /var/lib/postgresql/data/*;
"

echo "Running pg_basebackup from primary to hot backup..."
docker exec -u postgres db_hot_backup bash -c "
  /usr/lib/postgresql/16/bin/pg_basebackup \
    -h db_primary \
    -D /var/lib/postgresql/data \
    -U postgres \
    -Fp -Xs -P -R
"

echo "Starting hot backup in standby mode..."
docker exec -u postgres db_hot_backup bash -c "
  /usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/data -w start
"

echo "Hot backup setup complete."
