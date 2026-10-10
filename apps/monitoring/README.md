# Monitoring alerts

- Local-path PVCs share the node filesystem; `storage-alerts.yaml` suppresses
  their individual space/inode alerts using `kube_persistentvolumeclaim_info`.
  Other storage classes retain PVC alerts. If storage-class metrics disappear,
  PVC notifications return rather than silently losing coverage.
- Node disk warnings fire below 15% available for 30 minutes, or below 40%
  with a six-hour trend predicting exhaustion within four days. Critical fires
  below 5% for 10 minutes. Existing node inode alerts remain enabled.
- `/nix/store` is a bind mount of `/` on Hyperion and is excluded from filesystem
  rules. Other physical mounts, including media disks, remain monitored.
- Revisit the local-path exclusion if its storage directories move to a
  filesystem not covered by node-exporter.

## Telegram

Messages show status/severity, alert name, a bounded resource identifier and
summary (disk messages include mount and available space). At most five alerts
are listed; the Details link opens Alertmanager for the complete list. All
values are HTML-escaped and truncated to keep messages below Telegram's limit.
Alertmanager disables link previews natively.

Warnings repeat every 12 hours and critical alerts every 4 hours, with a
one-minute initial wait and five-minute update interval. Watchdog still goes
only to Healthchecks. Disk/PVC severity inhibition matches the affected resource
so one critical disk cannot hide another disk's warning.

## Private links

Prometheus and Alertmanager attach only to the existing HTTPS Gateway listener:

- https://prometheus.k8s.hyperion.internal
- https://alertmanager.k8s.hyperion.internal

These hosts currently resolve to Hyperion's private IP. Devices opening Telegram
links need private network/VPN access, working internal DNS, and trust for the
internal TLS CA. The routes do not add authentication; do not forward them to the
public internet. Alertmanager permits creating silences, so only trusted clients
should have access.

## Rollout

Argo CD auto-syncs monitoring from the repository's HEAD. Pushing these changes
can therefore deploy them; review before pushing. After rollout, verify HTTPS
links from the phone and confirm Telegram firing/resolved messages arrive.
