import bpy, sys, os
argv = sys.argv[sys.argv.index('--')+1:]
src, outdir = argv[0], argv[1]
os.makedirs(outdir, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.vrm')
bpy.ops.import_scene.vrm(filepath=src)
for o in bpy.data.objects:
    if o.type=='MESH':
        print('MESH', o.name, len(o.data.vertices), len(o.data.polygons), [m.name for m in o.data.materials], 'shapekeys', len(o.data.shape_keys.key_blocks) if o.data.shape_keys else 0)
    else: print(o.type, o.name)
for im in bpy.data.images:
    if im.size[0]:
        fn = os.path.join(outdir, bpy.path.clean_name(im.name)+'.png')
        im.filepath_raw = fn; im.file_format='PNG'
        try: im.save(); print('IMG', im.name, im.size[:], fn)
        except Exception as e: print('IMGERR', im.name, e)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(outdir,'model.blend'))
