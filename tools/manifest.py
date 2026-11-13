"""Builds data/manifest.json, the notes index, from clones of the course repos.

Run by .github/workflows/diagrams.yml:  python3 tools/manifest.py <folder with the clones> data/manifest.json
A course repo's workflow rebuilds only its own course inside an existing manifest:
  python3 tools/manifest.py <folder with that clone> data/manifest.json <slug>
assets/app.js rebuilds a course with the same rules from GitHub's API on every visit, so keep the two in step.
To add a course, add it to TRACKS here and in the workflow, and give it a colour in assets/v2.css."""
import json, os, re, subprocess, sys

SRC, OUT = sys.argv[1], sys.argv[2]
ONLY = sys.argv[3] if len(sys.argv) > 3 else None

TRACKS = [
    dict(slug="pre-security", repo="Pre-Security", clone="pre-security",
         name="Pre-Security", ar="ما قبل الأمن السيبراني",
         blurb="Networking and Linux fundamentals: the OSI and TCP/IP models, core protocols, and the Linux file system, users and permissions.",
         status=None),
    dict(slug="intro", repo="Introduction-To-Cyber-Security", clone="introduction-to-cyber-security",
         name="Introduction to Cybersecurity", ar="مقدمة في الأمن السيبراني",
         blurb="How networks and the web work, how common attacks abuse them, and the controls that stop them: DNS, cryptography, firewalls, IDS and IPS.",
         status=None),
    dict(slug="essentials", repo="Cyber-Security-Essentials", clone="cyber-security-essentials",
         name="Cybersecurity Essentials", ar="أساسيات الأمن السيبراني",
         blurb="The defensive side end to end: MITRE ATT&CK and the Kill Chain, Active Directory, Zero Trust, DLP, log analysis and ransomware resilience.",
         status=None),
    dict(slug="sec450", repo="SEC450", clone="sec450",
         name="SANS SEC450", ar="أساسيات البلو تيم",
         blurb="Blue Team Fundamentals: how a SOC runs, SIEM, network traffic analysis, and reading Windows and Linux logs during an investigation.",
         status="Sections 450.1 to 450.3 written, 450.4 and 450.5 in progress"),
]

SMALL = {"and", "of", "the", "a", "vs", "to", "in", "for", "on"}
UP = {"vpn": "VPN", "dlp": "DLP", "siem": "SIEM", "mdm": "MDM", "raid": "RAID", "lockbit": "LockBit",
      "ssh": "SSH", "dns": "DNS"}


def pretty(name, is_file=True):
    if is_file:
        name = name[:-3] if name.lower().endswith(".md") else name
    name = name.strip()
    if " " in name:
        return name
    words = name.replace("-", " ").split()
    return " ".join(UP.get(w.lower(), w if (i and w.lower() in SMALL) else w[:1].upper() + w[1:])
                    for i, w in enumerate(words))


def topic_of(text):
    """The Topic cell of the info table at the top of a note, if there is one."""
    lines = text.lstrip("\ufeff").splitlines()[:12]
    for i, line in enumerate(lines):
        if line.lstrip().startswith("|") and i + 2 < len(lines):
            heads = [c.strip().lower() for c in line.strip().strip("|").split("|")]
            vals = [c.strip() for c in lines[i + 2].strip().strip("|").split("|")]
            if "topic" in heads and len(vals) == len(heads):
                v = re.sub(r"[*_`]", "", vals[heads.index("topic")]).strip()
                return v or None
            return None
    return None


ARABIC = re.compile(r"[؀-ۿ]")
WORD = re.compile(r"\S+")

data = {"owner": "ammaryasser28", "branch": "main", "tracks": []}
old = {}
if ONLY:
    old = {x["slug"]: x for x in json.load(open(OUT, encoding="utf-8"))["tracks"]}
    assert ONLY in old, f"unknown course {ONLY}"
for t in TRACKS:
    if ONLY and t["slug"] != ONLY:
        data["tracks"].append(old[t["slug"]])
        continue
    root = os.path.join(SRC, t["clone"])
    sections, loose = {}, []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted((d for d in dirnames if not d.startswith(".")), key=lambda d: (d.lower(), d))
        rel_dir = os.path.relpath(dirpath, root)
        for f in sorted(filenames, key=lambda f: (f.lower(), f)):
            if not f.lower().endswith(".md") or f.lower() == "readme.md":
                continue
            rel = f if rel_dir == "." else os.path.join(rel_dir, f).replace(os.sep, "/")
            text = open(os.path.join(dirpath, f), encoding="utf-8").read()
            words = len(WORD.findall(text))
            parts = rel.split("/")
            title = pretty(parts[-1])
            # a dashed file name ("log4shell-case-study.md") can't carry capitals or punctuation,
            # so the note's own Topic cell names it when it has one
            if "-" in parts[-1] and " " not in parts[-1].strip():
                title = topic_of(text) or title
            sub = [pretty(p, False) for p in parts[1:-1]]
            note = {"path": rel, "title": title, "sub": sub, "words": words}
            if len(parts) == 1:
                loose.append(note)
            else:
                sections.setdefault(pretty(parts[0], False), []).append(note)
    secs = [{"name": k, "notes": v} for k, v in sections.items()]
    if loose:
        secs.append({"name": "More topics", "notes": loose})
    n = sum(len(s["notes"]) for s in secs)
    w = sum(x["words"] for s in secs for x in s["notes"])
    sha = subprocess.run(["git", "-C", root, "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    data["tracks"].append({k: t[k] for k in ("slug", "repo", "name", "ar", "blurb", "status")} |
                          {"sha": sha, "count": n, "words": w, "sections": secs})

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
for t in data["tracks"]:
    print(t["slug"], t["count"], t["words"], [s["name"] for s in t["sections"]])
print("bytes", os.path.getsize(OUT))
