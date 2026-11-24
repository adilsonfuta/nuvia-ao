#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Define DATABASE_URL antes de executar este backup." >&2
  exit 2
fi
if [[ "${BACKUP_REQUIRE_OFFSITE:-false}" == "true" ]]; then
  : "${AGE_RECIPIENT:?Production backups require AGE_RECIPIENT}"
  : "${RCLONE_REMOTE:?Production backups require RCLONE_REMOTE}"
fi

backup_dir="${BACKUP_DIR:-backups}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
umask 077
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/nuvia-$timestamp.dump"
temporary_file="$backup_file.partial"
trap 'rm -f "$temporary_file"' EXIT

pg_dump --format=custom --no-owner --no-acl --file="$temporary_file" "$DATABASE_URL"
pg_restore --list "$temporary_file" >/dev/null

if [[ -n "${AGE_RECIPIENT:-}" ]]; then
  command -v age >/dev/null || { echo "AGE_RECIPIENT requer age instalado." >&2; exit 3; }
  age --recipient "$AGE_RECIPIENT" --output "$backup_file.age" "$temporary_file"
  rm -f "$temporary_file"
  backup_file="$backup_file.age"
else
  mv "$temporary_file" "$backup_file"
fi

if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  [[ "$backup_file" == *.age ]] || { echo "Encripta com AGE_RECIPIENT antes de enviar cópias para fora do servidor." >&2; exit 4; }
  command -v rclone >/dev/null || { echo "RCLONE_REMOTE requer rclone instalado e configurado." >&2; exit 5; }
  rclone copyto "$backup_file" "${RCLONE_REMOTE%/}/$(basename "$backup_file")" --immutable
fi

retention_days="${BACKUP_RETENTION_DAYS:-30}"
if [[ "$retention_days" =~ ^[0-9]+$ ]] && (( retention_days > 0 )); then
  find "$backup_dir" -maxdepth 1 -type f -name 'nuvia-*.dump*' -mtime "+$retention_days" -delete
fi
echo "Backup criado e validado: $backup_file"
