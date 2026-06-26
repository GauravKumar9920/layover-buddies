#!/bin/bash
# Downloads the licensed Mumbai stock clip used by index.html.
# Source: Pexels — free for commercial use, no attribution required (pexels.com/license)
# Clip: "Mumbai's iconic BMC building at twilight" — https://www.pexels.com/video/mumbai-s-iconic-bmc-building-at-twilight-35370261/
# Run this once from the apps/marketing/ folder on your Mac:  bash get-videos.sh
set -e
mkdir -p videos
echo "Downloading Mumbai twilight clip from Pexels…"
curl -L -o videos/mumbai-twilight.mp4 "https://www.pexels.com/download/video/35370261/"
echo "Done. Open index.html — the skyline band now plays video."
echo ""
echo "Optional swaps (just rename the download to videos/mumbai-twilight.mp4):"
echo "  Local train at station : https://www.pexels.com/download/video/30231439/"
echo "  Auto-rickshaw street   : https://www.pexels.com/download/video/30811848/"
echo "  Night traffic          : https://www.pexels.com/download/video/30213783/"
echo ""
echo "Tip: if the file is over ~8MB, compress it first:"
echo "  ffmpeg -i videos/mumbai-twilight.mp4 -vf scale=1280:-2 -an -crf 28 videos/out.mp4 && mv videos/out.mp4 videos/mumbai-twilight.mp4"
