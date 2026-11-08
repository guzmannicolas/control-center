# Playbook: Disaster Recovery & Restore Procedures

This manual contains verified emergency procedures for restoring Directus CMS, PostgreSQL databases, media volumes, and environment secrets from local VPS archives or offsite Google Drive backups.

## 1. Backup Anatomy

Nightly backup script `/home/adminnico/cms/scripts/backup.sh` generates tar archives in `/home/adminnico/cms/backups/cms-YYYYMMDD-HHMM.tar` containing:

1. `database.sql.gz`: Clean PostgreSQL dump with `--clean --if-exists` flags.
2. `uploads.tar.gz`: Compressed archive of Docker volume `cms_directus_uploads` (`/directus/uploads`).
3. `secrets.tar.gz`: Production `.env`, `.admin-token`, and certificates.

## 2. Emergency Recovery Steps

### Step A: Locate Target Archive
List available archives locally on the VPS:
```bash
ls -lh /home/adminnico/cms/backups/cms-*.tar
```
Or download the target archive from Google Drive using rclone:
```bash
~/.local/bin/rclone --config ~/.config/rclone/rclone.conf copy gcrypt:daily/cms-YYYYMMDD-HHMM.tar /home/adminnico/cms/backups/
```

### Step B: Unpack Archive in Temporary Directory
```bash
mkdir -p /tmp/cms-restore
cd /tmp/cms-restore
tar -xf /home/adminnico/cms/backups/cms-YYYYMMDD-HHMM.tar
# Directory /tmp/cms-restore/cms-YYYYMMDD-HHMM will contain the 3 sub-archives
cd cms-YYYYMMDD-HHMM
```

### Step C: Restore PostgreSQL Database
Execute within `/home/adminnico/cms`:
```bash
# Decompress and stream dump into PostgreSQL container
zcat /tmp/cms-restore/cms-YYYYMMDD-HHMM/database.sql.gz | \
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

### Step D: Restore Media Files Volume
Execute via an ephemeral Alpine container mounted to the Docker volume:
```bash
docker run --rm -v cms_directus_uploads:/data alpine \
  sh -c "rm -rf /data/* && tar -C /data -xzf -" < /tmp/cms-restore/cms-YYYYMMDD-HHMM/uploads.tar.gz
```

### Step E: Restore Environment Variables & Secrets
```bash
cd /home/adminnico/cms
tar -xzf /tmp/cms-restore/cms-YYYYMMDD-HHMM/secrets.tar.gz
```

### Step F: Restart Containers & Verify
```bash
cd /home/adminnico/cms
docker compose restart directus
curl -I https://cms.nicoguzmandev.com/server/ping
```

Clean up temporary restoration files:
```bash
rm -rf /tmp/cms-restore
```
