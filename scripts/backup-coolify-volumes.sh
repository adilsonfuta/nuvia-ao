#!/usr/bin/env bash
set -euo pipefail

: "${AGE_RECIPIENT:?Define AGE_RECIPIENT para cifrar a cópia antes de a guardar}"
: "${RCLONE_REMOTE:?Define RCLONE_REMOTE para guardar os ficheiros fora do servidor}"
: "${BACKUP_VOLUMES:?Lista os volumes Coolify a copiar, separados por espaços}"
command -v docker >/dev/null || { echo "docker é necessário no host Coolify." >&2; exit 2; }
command -v age >/dev/null || { echo "age é necessário no host Coolify." >&2; exit 2; }

backup_dir="${BACKUP_DIR:-backups}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
umask 077
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
for volume in $BACKUP_VOLUMES; do
  if ! docker volume inspect "$volume" >/dev/null 2>&1; then
    echo "Volume não encontrado: $volume" >&2
    exit 3
  fi
  safe_name="$(printf '%s' "$volume" | tr -c 'A-Za-z0-9_.-' '_')"
  output="$backup_dir/nuvia-volume-${safe_name}-${timestamp}.tar.gz.age"
  temporary="$output.partial"
  trap 'rm -f "$temporary"' EXIT
  docker run --rm -v "$volume:/source:ro" alpine:3.22 tar -czf - -C /source . \
    | age --recipient "$AGE_RECIPIENT" --output "$temporary" -
  mv "$temporary" "$output"
  command -v rclone >/dev/null || { echo "RCLONE_REMOTE requer rclone instalado e configurado." >&2; exit 4; }
  rclone copyto "$output" "${RCLONE_REMOTE%/}/$(basename "$output")" --immutable
  echo "Volume cifrado: $volume -> $output"
done

retention_days="${BACKUP_RETENTION_DAYS:-30}"
if [[ "$retention_days" =~ ^[0-9]+$ ]] && (( retention_days > 0 )); then
  find "$backup_dir" -maxdepth 1 -type f -name 'nuvia-volume-*.tar.gz.age' -mtime "+$retention_days" -delete
fi
