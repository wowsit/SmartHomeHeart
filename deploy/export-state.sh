#!/bin/bash
# Ist-Stand vom Pi holen und ins Repo schreiben (docs/IST-STAND.md + docs/ist-stand/).
# Aufruf aus dem Repo-Root:  deploy/export-state.sh          (SSH-Ziel per PI_SSH, Standard: wowsit@homehole)
# Danach: git add docs && git commit -m "Ist-Stand" && git push
set -euo pipefail
PI_SSH="${PI_SSH:-ssh}"
PI_SCP="${PI_SCP:-scp}"   # z.B. "scp -F ~/.ssh/config"; muss zu PI_SSH passen
PI_HOST="${PI_HOST:-wowsit@homehole}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
TMP="/tmp/ist-stand-$$"

$PI_SCP "$REPO/deploy/export-state.py" "$PI_HOST:/tmp/export-state.py"
$PI_SSH "$PI_HOST" "sudo -n python3 /tmp/export-state.py $TMP && sudo -n chown -R \$(id -u) $TMP && tar czf $TMP.tgz -C $TMP ."
$PI_SCP "$PI_HOST:$TMP.tgz" "/tmp/ist-stand.tgz"
$PI_SSH "$PI_HOST" "rm -rf $TMP $TMP.tgz /tmp/export-state.py"

UNPACK="$(mktemp -d)"
tar xzf /tmp/ist-stand.tgz -C "$UNPACK"
rm -rf "$REPO/docs/ist-stand"; mkdir -p "$REPO/docs/ist-stand"
mv "$UNPACK/IST-STAND.md" "$REPO/docs/IST-STAND.md" && cp -a "$UNPACK/ist-stand/." "$REPO/docs/ist-stand/"
rm -rf "$UNPACK" /tmp/ist-stand.tgz
# Repo-↔-Pi-Vergleich lokal nachziehen (das Skript auf dem Pi kennt das Repo nicht)
REPO_DIR="$REPO" python3 - <<'PY'
import os,re,pathlib
repo=pathlib.Path(os.environ["REPO_DIR"]); md=repo/"docs/IST-STAND.md"; s=md.read_text()
pairs=[("scripts.yaml","assistant/homeassistant/scripts.yaml"),("claude_prompt.live.txt","assistant/homeassistant/claude_prompt.txt"),("nginx.conf","deploy/nginx.conf")]
lines=[]
for live,src in pairs:
    a,b=repo/"docs/ist-stand"/live, repo/src
    if a.exists() and b.exists():
        norm=lambda t: " ".join(re.sub(r"^\s*#.*$", "", t, flags=re.M).split())
        same=norm(a.read_text())==norm(b.read_text())  # Kommentare/Umbrüche ignorieren (HA formatiert YAML um)
        lines.append(f"- `{src}` ↔ live: {'identisch ✅' if same else '**abweichend** ⚠️ (Repo-Datei oder Pi aktualisieren)'}")
block="### Repo ↔ Pi\n\n"+"\n".join(lines)+"\n\n"
s=re.sub(r"### Repo ↔ Pi\n\n(?:- .*\n)+\n","",s)
s=s.replace("### Letzte Warnungen/Fehler im HA-Log", block+"### Letzte Warnungen/Fehler im HA-Log",1)
md.write_text(s)
PY
echo "docs/IST-STAND.md aktualisiert"
