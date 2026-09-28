#!/bin/bash
# Optimise character VRMs into assets/vrm (textures resized/re-encoded; VRM data untouched)
set -e
cd $(dirname $0)
W=${WORK:-/workspace/bba_tools/tmp}; S=${SRC_DIR:-/workspace/bba_src/vrm}
node optimize_vrm.mjs $W/rusana.vrm ../assets/vrm/rusana.vrm 1024 'Body_00$=2048' 'nml=512' | tail -1
node optimize_vrm.mjs $S/AvatarSample_C.vrm ../assets/vrm/guy_a.vrm 1024 'nml=512' | tail -1
node optimize_vrm.mjs $S/HairSample_Male.vrm ../assets/vrm/guy_b.vrm 1024 'nml=512' | tail -1
