#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import subprocess
import time
import os
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

GH_BIN = r"C:\Program Files\GitHub CLI\gh.exe"
if not os.path.exists(GH_BIN):
    GH_BIN = "gh"

from create_github_issues import STORIES

def update_all_issues():
    print(f"[*] Bat dau cap nhat {len(STORIES)} Issues tren GitHub (Issues #1 den #{len(STORIES)})...")
    for idx, story in enumerate(STORIES, start=1):
        issue_id = str(idx)
        print(f"  [{idx}/{len(STORIES)}] Cap nhat Issue #{issue_id}: {story['title'][:60]}...")
        cmd = [
            GH_BIN, "issue", "edit", issue_id,
            "--repo", "Duan0603/TerraWatch",
            "--title", story["title"],
            "--body", story["body"]
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if res.returncode == 0:
            print(f"    [OK] Cap nhat thanh cong Issue #{issue_id}")
        else:
            print(f"    [FAIL] Loi Issue #{issue_id}: {res.stderr.strip()}")
        time.sleep(1)

    print("\n[DONE] Hoan thanh cap nhat toan bo 19 Issues tren GitHub!")

if __name__ == "__main__":
    update_all_issues()
