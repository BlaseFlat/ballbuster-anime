#!/bin/bash
# Rebuild Rusana: textures (python) -> Blender edit -> VRM
set -e
HERE=$(cd $(dirname $0) && pwd); ROOT=$HERE/../..
BL=${BLENDER:-/workspace/tools/blender/blender-4.2.23-linux-x64/blender}
SRC=${SRC:-/workspace/bba_src/vrm/AvatarSample_B.vrm}
WORK=${WORK:-/workspace/bba_tools/tmp}
[ -d $WORK/B ] || $BL -b --python $ROOT/tools/blender/inspect.py -- $SRC $WORK/B
node $HERE/hand_uv_mask.mjs $SRC $WORK/hand_mask.png
HAND_MASK=$WORK/hand_mask.png python3 $HERE/tex_rusana.py $WORK/B $WORK/rus_tex
$BL -b --python $ROOT/tools/blender/build_rusana.py -- $SRC $WORK/rus_tex $WORK/rusana.vrm "$@" 2>&1 | grep -E "deleted|tie|EXPORT|Error|Trace|CLOTH|FIGURE" 
