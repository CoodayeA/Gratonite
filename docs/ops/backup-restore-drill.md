# Backup and Restore Drill Checklist

Date: 2026-02-22

1. Take fresh DB backup.
2. Verify object storage backup/snapshot.
3. Restore into staging environment.
4. Run auth/message/file smoke against restored env.
5. Record restore duration and gaps.
