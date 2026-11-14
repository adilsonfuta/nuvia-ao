#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Define DATABASE_URL antes de executar este backup." >&2
  exit 2
fi

backup_dir="${BACKUP_DIR:-backups}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
umask 077
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/casar-angola-$timestamp.dump"

pg_dump --format=custom --no-owner --no-acl --file="$backup_file" "$DATABASE_URL"
echo "Backup criado em $backup_file"
