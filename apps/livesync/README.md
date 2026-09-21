# Obsidian Self-hosted LiveSync

## Layout

- CouchDB 3.5.0 runs once in namespace `livesync`; data is on the `couchdb-data` local-path PVC.
- LiveSync Bridge is built from upstream commit `c3760beaa0851214da4860903445d7f6420ca025` plus the two-file exclusion overlay in `image/`.
- The bridge mounts the agent's real vault, `/home/dgabka/notes`, directly on the only cluster node. It runs as the vault owner (`1000:100`), uses `Recreate`, and stores Deno/offline-scan state on `bridge-state`.
- CouchDB is internal at `http://couchdb.livesync.svc:5984` and privately reachable at `https://livesync.k8s.hyperion.internal`. Traefik terminates the existing internal wildcard certificate. There is no public route.
- Devices and the bridge use the restricted `livesync` CouchDB user. Admin credentials are only used by CouchDB and the idempotent provisioning Job.

The bridge starts at **zero replicas** until the image is published, a temporary-vault test passes, and a one-time backup exists. The real vault is the authoritative initial seed; never use **Overwrite Server** from a client during initial setup.

## Build and deploy

Build for the cluster's amd64 node from the repository root:

```sh
podman build --format oci -t ghcr.io/dgabka/livesync-bridge:c3760be-excludes1 apps/livesync/image
podman push ghcr.io/dgabka/livesync-bridge:c3760be-excludes1
podman image inspect ghcr.io/dgabka/livesync-bridge:c3760be-excludes1 --format '{{.Digest}}'
```

Update `manifests/bridge.yaml` if the registry digest differs. Commit and push through the normal Argo CD workflow; do not `kubectl apply` these resources. Argo creates CouchDB but leaves the bridge stopped.

Decrypt credentials only into a protected local file or environment; do not paste them into commands, chat, or logs:

```sh
sops -d apps/livesync/manifests/secrets.sops.yaml
```

### Mandatory preflight and temporary test

1. Confirm no other sync engine watches `/home/dgabka/notes`.
2. Run and verify an off-host backup before starting any bridge:
   ```sh
   ssh hyperion 'restic-hyperion backup /home/dgabka/notes && restic-hyperion snapshots --latest 1'
   ```
3. Use a temporary database and `/home/dgabka/livesync-smoke-vault` with the same image/config. Verify local→remote and remote→local create, edit, and delete; stop the bridge, change both sides, restart, and verify the persisted `/deno-dir/location_data` catches offline changes. Recreate the container and repeat. Make conflicting edits and record which copy wins/conflicts.
4. Leave the smoke bridge running long enough to verify remote→filesystem changes continue (not only uploads). Check the health heartbeat and file contents, not just process status.
5. Delete only the temporary database and directory after the results are recorded. Never run `--reset` against the real bridge.
6. Change `spec.replicas` in `manifests/bridge.yaml` from `0` to `1`, commit, and push. Wait for the initial upload to settle before connecting a client.

## Exclusions and agent behavior

The small upstream overlay adds bidirectional storage exclusions. The deployment excludes `.git`, `.obsidian`, `.agents`, macOS metadata, Vim/session files, swap files, backups ending in `~`, and `*.tmp`. Root `AGENTS.md` and normal Markdown files remain included. Add an exclusion before introducing another generated or machine-specific path.

OpenClaw remains a host user service; its jobs and vault logic are unchanged. Do not enable Git/Obsidian Sync/another bridge against the same vault concurrently.

## Client setup (macOS and iOS)

1. Install Obsidian **Self-hosted LiveSync 1.0.30** or a compatible newer release (Obsidian 1.7.2+).
2. Ensure the device can resolve/reach `livesync.k8s.hyperion.internal` through the existing private network and trusts the internal TLS CA.
3. In the plugin setup wizard choose CouchDB and enter:
   - URI: `https://livesync.k8s.hyperion.internal`
   - database: `livesync`
   - username/password: `app-username` and `app-password` from the SOPS secret
4. Enable end-to-end encryption and path obfuscation. Use `e2ee-passphrase` for both. Keep **Use Remote Configuration / remote tweaks** enabled so chunking/compression settings match the bridge. Do not independently change chunk splitter, compression, case-sensitivity, or encryption algorithm.
5. Validate the database configuration. If a client still reports CORS trouble, enable **Use Internal API / Use Request API**; HTTPS and authentication remain required.
6. On the first client, choose the workflow for adding an existing remote vault and **Fetch** into an empty/local backup vault. Never choose **Overwrite Server**. Repeat for iOS after desktop validation.
7. A setup URI may be generated for the second device; protect it with a separate setup-URI passphrase and transfer it privately.

On iOS, synchronization resumes while Obsidian is open. Continuous background synchronization is not guaranteed.

## Operations

- Verify agent freshness: create a uniquely named note on a client, wait for replication, then run `ssh hyperion 'stat /home/dgabka/notes/<note>.md'` and inspect its expected content. Repeat in the opposite direction.
- Health: `kubectl -n livesync get pods,pvc,job,httproute`; inspect bridge logs without printing its generated config.
- Upgrade: pin a reviewed upstream commit and base-image digest, rebuild/push, update the image digest, rerun the temporary-vault matrix, then use the normal GitOps commit. `Recreate` prevents overlapping bridge instances.
- Backup: host Restic covers `/var/lib/rancher/k3s/storage` (both PVCs). The accompanying Nix change adds `/home/dgabka/notes`. Verify both schedules and a restore before relying on them. The Git vault is not a substitute for CouchDB/bridge-state backup.
- Recovery: stop the bridge first; restore the vault, CouchDB PVC, and bridge-state PVC from one consistent Restic snapshot; start CouchDB, then one bridge. Restore into a temporary location and inspect before replacing real data. Never reset/reseed automatically.
