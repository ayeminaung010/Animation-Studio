#!/bin/sh
# Final master for a lemo film: the library's mux (grain, 24 fps) for the picture, then the audio again from
# out/mix.wav with a -2.2 dBTP ceiling so AAC overshoot stays under the channel's -1 dBTP rule.
#   usage: sh master.sh <project-dir> <name>      (writes <project-dir>/<name>.mp4)
#   needs: <project-dir>/out/video.mp4 (video.mjs) and <project-dir>/out/mix.wav; LIB = library folder (default ~/lemo-opuscar)
#   prints the measured "I:" and "Peak:" lines; exit 0 = ok, 1 = true peak above -1.0 dBTP, 2 = bad usage / missing input
die() { echo "master.sh: $*" >&2; exit 2; }
PROJ="$1"; NAME="$2"
[ -n "$PROJ" ] && [ -n "$NAME" ] || die "usage: sh master.sh <project-dir> <name>"
[ -d "$PROJ" ] || die "project directory not found: $PROJ"
case "$NAME" in */*|'') die "name must be a plain file name without '/', got '$NAME'";; esac
LIB="${LIB:-$HOME/lemo-opuscar}"
[ -f "$LIB/core/render/mux.sh" ] || die "library not found: set LIB to the lemo-opuscar folder (looked in $LIB)"
cd "$PROJ" || die "cannot enter $PROJ"
[ -f out/video.mp4 ] || die "out/video.mp4 missing in $PROJ (render the picture first with core/render/video.mjs)"
[ -f out/mix.wav ] || die "out/mix.wav missing in $PROJ (mix the audio first)"
set -e

sh "$LIB/core/render/mux.sh" out/video.mp4 out/mix.wav out/grained.mp4 24 3 >/dev/null

M=$(ffmpeg -hide_banner -nostats -i out/mix.wav -af loudnorm=I=-14:TP=-2.2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$M" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
for k in input_i input_tp input_lra input_thresh target_offset; do
  case "$(g $k)" in ''|*inf*|*nan*) echo "master.sh: cannot measure out/mix.wav (silent or unreadable): $k = '$(g $k)'" >&2; exit 2;; esac
done

rm -f "$NAME.mp4"
ffmpeg -v error -y -i out/grained.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v copy \
  -af "loudnorm=I=-14:TP=-2.2:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" \
  -c:a aac -b:a 192k -shortest -movflags +faststart "$NAME.mp4"

R=$(ffmpeg -hide_banner -nostats -i "$NAME.mp4" -af ebur128=peak=true -f null - 2>&1 | grep -E '^ *(I|Peak):')
echo "$R"
PEAK=$(echo "$R" | awk '$1 == "Peak:" { p = $2 } END { print p }')
[ -n "$PEAK" ] || { echo "master.sh: could not read the measured peak" >&2; exit 2; }
if awk -v p="$PEAK" 'BEGIN { exit !(p + 0 > -1.0) }'; then
  echo "master.sh: true peak $PEAK dBTP is above -1.0: lower or limit the mix and run again" >&2
  exit 1
fi
echo "$PROJ/$NAME.mp4"
