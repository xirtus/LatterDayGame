"""Render a consistent catalog preview of a GLB with Blender Workbench."""
import bpy, sys
from mathutils import Vector
argv = sys.argv[sys.argv.index('--')+1:]
src, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for o in list(bpy.data.objects):
    if o.animation_data: o.animation_data_clear()
    if o.type == 'ARMATURE':
        for pb in o.pose.bones:
            pb.location=(0,0,0); pb.rotation_mode='QUATERNION'; pb.rotation_quaternion=(1,0,0,0); pb.scale=(1,1,1)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
for o in list(bpy.context.scene.objects):
    if o.type=='MESH' and (o.name.startswith('Icosphere') or o.hide_render):
        bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
mn=Vector((1e9,1e9,1e9)); mx=Vector((-1e9,-1e9,-1e9))
for o in objs:
    ev=o.evaluated_get(deps); me=ev.to_mesh()
    for v in me.vertices:
        w=ev.matrix_world@v.co
        mn.x=min(mn.x,w.x); mn.y=min(mn.y,w.y); mn.z=min(mn.z,w.z)
        mx.x=max(mx.x,w.x); mx.y=max(mx.y,w.y); mx.z=max(mx.z,w.z)
    ev.to_mesh_clear()
center=(mn+mx)/2; size=mx-mn
cam_data=bpy.data.cameras.new('Cam'); cam_data.type='ORTHO'
cam=bpy.data.objects.new('Cam',cam_data); bpy.context.scene.collection.objects.link(cam)
direction=Vector((0.35,-1.0,0.05)); direction.normalize()
cam.location=center+direction*8
cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
cam_data.ortho_scale=max(size.z,size.x/0.8,size.y/0.8)*1.10
bpy.context.scene.camera=cam
bpy.ops.mesh.primitive_plane_add(size=30, location=(center.x,center.y,mn.z-0.004))
floor=bpy.context.active_object
mat=bpy.data.materials.new('Floor'); mat.diffuse_color=(0.70,0.69,0.66,1)
floor.data.materials.append(mat)
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
sh=scene.display.shading
sh.light='STUDIO'; sh.color_type='TEXTURE'; sh.show_shadows=True
sh.show_cavity=True; sh.cavity_type='BOTH'; sh.curvature_ridge_factor=1.0; sh.curvature_valley_factor=1.0
sh.show_specular_highlight=False
sh.background_type='VIEWPORT'; sh.background_color=(0.74,0.73,0.70)
scene.display.render_aa='16'
scene.render.resolution_x=640; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=out
bpy.ops.render.render(write_still=True)
print('WROTE',out)
