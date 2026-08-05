#!/bin/bash
# De-risk Phase 2 (kitty socket as a true mid-turn interrupt) WITHOUT touching the
# owner's running kitty and without the config change + restart it would need.
#
# STATUS's warning is the thing to settle: "a --match that matches nothing sends
# the nudge into the void and LOOKS EXACTLY LIKE an agent ignoring it." If a
# non-matching send exits 0, the transport is unfalsifiable at the point of use —
# which is the failure mode this whole project exists to prevent.
set -u
K=/home/leonh/.local/kitty.app/bin/kitty
KT=/home/leonh/.local/kitty.app/bin/kitten
SOCK=unix:/tmp/kitty-probe-$$.sock
OUT=/tmp/kitty-probe-received-$$.txt
rm -f "$OUT"

echo "=== launching a HIDDEN, detached kitty with remote control (yours is untouched) ==="
"$K" --start-as=hidden --detach --listen-on="$SOCK" -o allow_remote_control=yes \
     --detached-log=/tmp/kitty-probe-log-$$.txt 2>&1
for i in $(seq 1 30); do "$KT" @ --to "$SOCK" ls >/dev/null 2>&1 && break; sleep 0.2; done
"$KT" @ --to "$SOCK" ls >/dev/null 2>&1 || { echo "✗ could not reach the test instance — probe void"; exit 1; }
echo "  ✓ reachable on $SOCK"

cleanup() { "$KT" @ --to "$SOCK" close-window --match all >/dev/null 2>&1; sleep 0.3; pkill -f "kitty-probe-$$" >/dev/null 2>&1; rm -f "$OUT"; }
trap cleanup EXIT

echo
echo "=== create a window standing in for an agent split, titled like an agent ==="
# Must keep reading FOREVER. A one-shot `read` stops consuming stdin after the
# first send, so a later send lands nowhere and the control cannot tell a failed
# MATCH from a target that simply stopped listening — which is what happened on
# the first run of this probe.
"$KT" @ --to "$SOCK" launch --title "comm-expert-web-app" --keep-focus \
      sh -c "while IFS= read -r line; do printf '%s\n' \"\$line\" >> $OUT; done" >/dev/null 2>&1
sleep 0.5

echo "--- kitten @ ls: does it expose the title? ---"
"$KT" @ --to "$SOCK" ls 2>/dev/null | /usr/bin/grep -o '"title": "[^"]*"' | sort -u | head -5

echo
echo "=== ARM 1 — send to a title that EXISTS (must actually arrive) ==="
"$KT" @ --to "$SOCK" send-text --match "title:comm-expert-web-app" "NUDGE_ARRIVED
" 2>&1
echo "  exit=$?"
sleep 0.6
if [ -s "$OUT" ]; then echo "  ✓ text ARRIVED in the target window: $(cat "$OUT")"; else echo "  ✗ nothing arrived"; fi

echo
echo "=== ARM 2 — THE ONE THAT MATTERS: send to a title that matches NOTHING ==="
o=$("$KT" @ --to "$SOCK" send-text --match "title:no-such-agent-anywhere" "INTO_THE_VOID
" 2>&1); rc=$?
echo "  exit=$rc"
echo "  stderr/stdout: ${o:-(silent)}"
if [ $rc -eq 0 ]; then
	echo "  🔴 EXIT 0 ON A MATCH OF NOTHING — the nudge vanished and the sender was told it worked."
	echo "     Any Phase 2 built on this MUST verify the match resolves BEFORE sending,"
	echo "     or it reproduces the exact defect the bus just fixed."
else
	echo "  ✓ non-zero on no match — the transport is falsifiable at the point of use."
fi

echo
echo "=== ARM 3 — control: is the match actually discriminating, or does it hit everything? ==="
"$KT" @ --to "$SOCK" send-text --match "title:comm-expert-web-app" "SECOND
" >/dev/null 2>&1
sleep 0.6
echo "  target window received, in order:"
sed 's/^/    /' "$OUT" 2>/dev/null
if /usr/bin/grep -q SECOND "$OUT" 2>/dev/null; then
	if /usr/bin/grep -q INTO_THE_VOID "$OUT" 2>/dev/null; then
		echo "  ⚠ the no-match send ALSO landed here — --match is not discriminating at all"
	else
		echo "  ✓ CONTROL HOLDS: the same match still reaches the window, and the no-match send"
		echo "    never arrived anywhere. ARM 2's exit 0 is a genuine silent discard."
	fi
else
	echo "  ⚠ nothing arrived — ARM 2 remains uninterpretable, do not conclude from it"
fi
